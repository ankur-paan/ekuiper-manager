import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, validatePassword, verifyPassword } from '@/lib/auth/password';
import {
  createSession,
  setSessionCookie,
} from '@/lib/auth/session';
import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  readJsonObject,
  requireUser,
} from '@/lib/api';
import { recordAuditSafely } from '@/lib/audit';
import { query, withTransaction } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireUser(request, { allowPasswordChange: true });
    const body = await readJsonObject(request);
    if (typeof body.currentPassword !== 'string') {
      throw new ApiError(400, 'Current password is required', 'INVALID_PASSWORD');
    }
    const passwordError = validatePassword(body.newPassword);
    if (passwordError) throw new ApiError(400, passwordError, 'INVALID_PASSWORD');
    if (body.currentPassword === body.newPassword) {
      throw new ApiError(400, 'New password must be different', 'INVALID_PASSWORD');
    }

    const result = await query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [user.id],
    );
    if (!result.rows[0] || !(await verifyPassword(body.currentPassword, result.rows[0].password_hash))) {
      throw new ApiError(401, 'Current password is incorrect', 'INVALID_CREDENTIALS');
    }

    const passwordHash = await hashPassword(body.newPassword as string);
    await withTransaction(async (client) => {
      const changed = await client.query(
        `UPDATE users
            SET password_hash = $1, must_change_password = false, updated_at = now()
          WHERE id = $2 AND password_hash = $3`,
        [passwordHash, user.id, result.rows[0].password_hash],
      );
      if (!changed.rowCount) {
        throw new ApiError(409, 'Password changed in another session', 'PASSWORD_CHANGED');
      }
      await client.query(
        'UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
        [user.id],
      );
    });
    const session = await createSession(user.id);
    const response = NextResponse.json({ success: true });
    setSessionCookie(response, session.token, session.expiresAt);
    recordAuditSafely({
      actorId: user.id,
      action: 'user.change_password',
      resourceType: 'user',
      resourceId: user.id,
      success: true,
    });
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}

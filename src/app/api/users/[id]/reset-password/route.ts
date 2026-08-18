import { NextRequest, NextResponse } from 'next/server';
import { generateTemporaryPassword, hashPassword } from '@/lib/auth/password';
import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  requireUser,
} from '@/lib/api';
import { recordAuditSafely } from '@/lib/audit';
import { withTransaction } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const actor = await requireUser(request, { owner: true });
    const { id } = await params;
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    await withTransaction(async (client) => {
      const result = await client.query(
        `UPDATE users
            SET password_hash = $1, must_change_password = true, updated_at = now()
          WHERE id = $2`,
        [passwordHash, id],
      );
      if (!result.rowCount) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
      await client.query(
        'UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
        [id],
      );
    });
    recordAuditSafely({
      actorId: actor.id,
      action: 'user.reset_password',
      resourceType: 'user',
      resourceId: id,
      success: true,
    });
    return NextResponse.json({ temporaryPassword });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

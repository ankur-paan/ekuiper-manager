import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { hashPassword, validatePassword } from '@/lib/auth/password';
import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  normalizeUsername,
  readJsonObject,
  validateUsername,
} from '@/lib/api';
import { recordAuditSafely } from '@/lib/audit';
import { withTransaction } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    // Raised alongside the login limit for the same reason: a browser suite bootstraps the
    // owner account repeatedly from one address. Bootstrap only succeeds while no owner
    // exists, so a higher ceiling here grants no additional reach once setup is complete.
    consumeRateLimit(`bootstrap:${request.headers.get('x-forwarded-for') ?? 'local'}`, {
      limit: 50,
      windowMs: 15 * 60 * 1_000,
    });
    const body = await readJsonObject(request);
    const username = validateUsername(body.username);
    const passwordError = validatePassword(body.password);
    if (passwordError) throw new ApiError(400, passwordError, 'INVALID_PASSWORD');
    const passwordHash = await hashPassword(body.password as string);
    const userId = randomUUID();

    await withTransaction(async (client) => {
      await client.query('LOCK TABLE users IN EXCLUSIVE MODE');
      const existing = await client.query('SELECT 1 FROM users LIMIT 1');
      if (existing.rowCount) {
        throw new ApiError(409, 'Setup has already been completed', 'SETUP_COMPLETE');
      }
      await client.query(
        `INSERT INTO users
           (id, username, username_normalized, password_hash, role, must_change_password)
         VALUES ($1, $2, $3, $4, 'OWNER', false)`,
        [userId, username, normalizeUsername(username), passwordHash],
      );
    });

    const session = await createSession(userId);
    const response = NextResponse.json(
      { user: { id: userId, username, role: 'OWNER', mustChangePassword: false } },
      { status: 201 },
    );
    setSessionCookie(response, session.token, session.expiresAt);
    recordAuditSafely({
      actorId: userId,
      action: 'installation.bootstrap',
      resourceType: 'installation',
      success: true,
    });
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}

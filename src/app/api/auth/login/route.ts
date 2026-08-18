import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  normalizeUsername,
  readJsonObject,
  validateUsername,
} from '@/lib/api';
import { recordAuditSafely } from '@/lib/audit';
import { query } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';

interface LoginUserRow {
  id: string;
  username: string;
  password_hash: string;
  role: 'OWNER' | 'USER';
  must_change_password: boolean;
  disabled_at: Date | null;
}

const dummyHash = hashPassword('not-a-real-user-password');

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    const username = validateUsername(body.username);
    if (typeof body.password !== 'string' || body.password.length > 128) {
      throw new ApiError(401, 'Invalid username or password', 'INVALID_CREDENTIALS');
    }
    const clientKey = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local';
    consumeRateLimit(`login:${clientKey}:${normalizeUsername(username)}`, {
      limit: 10,
      windowMs: 15 * 60 * 1_000,
    });

    const result = await query<LoginUserRow>(
      `SELECT id, username, password_hash, role, must_change_password, disabled_at
         FROM users WHERE username_normalized = $1`,
      [normalizeUsername(username)],
    );
    const user = result.rows[0];
    const valid = await verifyPassword(body.password, user?.password_hash ?? (await dummyHash));
    if (!user || !valid || user.disabled_at) {
      recordAuditSafely({
        action: 'auth.login',
        resourceType: 'session',
        success: false,
        metadata: { username },
      });
      throw new ApiError(401, 'Invalid username or password', 'INVALID_CREDENTIALS');
    }

    await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
    const session = await createSession(user.id);
    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        mustChangePassword: user.must_change_password,
      },
    });
    setSessionCookie(response, session.token, session.expiresAt);
    recordAuditSafely({
      actorId: user.id,
      action: 'auth.login',
      resourceType: 'session',
      success: true,
    });
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { useSecureCookies } from '@/lib/cookies';

export const SESSION_COOKIE = 'ekuiper_manager_session';

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: 'OWNER' | 'USER';
  mustChangePassword: boolean;
}

interface SessionRow {
  session_id: string;
  user_id: string;
  username: string;
  role: 'OWNER' | 'USER';
  must_change_password: boolean;
  last_seen_at: Date;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function sessionExpiry(): Date {
  const hours = Number(process.env.SESSION_TTL_HOURS ?? 12);
  return new Date(Date.now() + Math.max(1, Math.min(hours, 168)) * 60 * 60 * 1_000);
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = sessionExpiry();
  await query(
    `INSERT INTO sessions (id, token_hash, user_id, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [randomUUID(), hashToken(token), userId, expiresAt],
  );
  return { token, expiresAt };
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date,
): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: useSecureCookies(),
    sameSite: 'strict',
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: useSecureCookies(),
    sameSite: 'strict',
    path: '/',
    expires: new Date(0),
  });
}

export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await query('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1', [hashToken(token)]);
}

export async function revokeUserSessions(userId: string): Promise<void> {
  await query(
    'UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
    [userId],
  );
}

export async function getAuthenticatedUser(
  request: NextRequest,
): Promise<AuthenticatedUser | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const result = await query<SessionRow>(
    `SELECT s.id AS session_id, s.last_seen_at, u.id AS user_id, u.username, u.role,
            u.must_change_password
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
        AND u.disabled_at IS NULL`,
    [hashToken(token)],
  );
  const row = result.rows[0];
  if (!row) return null;

  if (Date.now() - new Date(row.last_seen_at).getTime() > 5 * 60 * 1_000) {
    void query('UPDATE sessions SET last_seen_at = now() WHERE id = $1', [row.session_id]).catch(
      () => undefined,
    );
  }

  return {
    id: row.user_id,
    username: row.username,
    role: row.role,
    mustChangePassword: row.must_change_password,
  };
}

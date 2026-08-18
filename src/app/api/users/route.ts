import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { generateTemporaryPassword, hashPassword, validatePassword } from '@/lib/auth/password';
import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  normalizeUsername,
  readJsonObject,
  requireUser,
  validateUsername,
} from '@/lib/api';
import { recordAuditSafely } from '@/lib/audit';
import { query } from '@/lib/db';

interface UserRow {
  id: string;
  username: string;
  role: 'OWNER' | 'USER';
  must_change_password: boolean;
  disabled_at: Date | null;
  last_login_at: Date | null;
  created_at: Date;
}

function toUser(row: UserRow) {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    mustChangePassword: row.must_change_password,
    disabled: Boolean(row.disabled_at),
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireUser(request, { owner: true });
    const result = await query<UserRow>(
      `SELECT id, username, role, must_change_password, disabled_at, last_login_at, created_at
         FROM users ORDER BY created_at ASC`,
    );
    return NextResponse.json({ users: result.rows.map(toUser) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const actor = await requireUser(request, { owner: true });
    const body = await readJsonObject(request);
    const username = validateUsername(body.username);
    const role = body.role === 'OWNER' ? 'OWNER' : 'USER';
    const suppliedPassword = body.password;
    const temporaryPassword =
      typeof suppliedPassword === 'string' && suppliedPassword.length > 0
        ? suppliedPassword
        : generateTemporaryPassword();
    const passwordError = validatePassword(temporaryPassword);
    if (passwordError) throw new ApiError(400, passwordError, 'INVALID_PASSWORD');
    const passwordHash = await hashPassword(temporaryPassword);
    const id = randomUUID();

    try {
      await query(
        `INSERT INTO users
           (id, username, username_normalized, password_hash, role, must_change_password)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [id, username, normalizeUsername(username), passwordHash, role],
      );
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ApiError(409, 'That username already exists', 'USERNAME_EXISTS');
      }
      throw error;
    }

    recordAuditSafely({
      actorId: actor.id,
      action: 'user.create',
      resourceType: 'user',
      resourceId: id,
      success: true,
      metadata: { role },
    });
    return NextResponse.json(
      {
        user: { id, username, role, mustChangePassword: true, disabled: false },
        temporaryPassword,
      },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

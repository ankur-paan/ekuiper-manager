import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthenticatedUser, type AuthenticatedUser } from '@/lib/auth/session';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'REQUEST_FAILED',
  ) {
    super(message);
  }
}

export async function requireUser(
  request: NextRequest,
  options: { owner?: boolean; allowPasswordChange?: boolean } = {},
): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser(request);
  if (!user) throw new ApiError(401, 'Sign in required', 'AUTH_REQUIRED');
  if (options.owner && user.role !== 'OWNER') {
    throw new ApiError(403, 'Owner access required', 'OWNER_REQUIRED');
  }
  if (user.mustChangePassword && !options.allowPasswordChange) {
    throw new ApiError(403, 'Password change required', 'PASSWORD_CHANGE_REQUIRED');
  }
  return user;
}

export function assertSameOrigin(request: NextRequest): void {
  const origin = request.headers.get('origin');
  const expected = process.env.MANAGER_ORIGIN ?? request.nextUrl.origin;
  if (!origin || origin !== expected) {
    throw new ApiError(403, 'Request origin is not allowed', 'ORIGIN_REJECTED');
  }
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0];
  if (contentType !== 'application/json') {
    throw new ApiError(415, 'Content-Type must be application/json', 'UNSUPPORTED_MEDIA_TYPE');
  }
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('not an object');
    }
    return body as Record<string, unknown>;
  } catch {
    throw new ApiError(400, 'Request body must be a JSON object', 'INVALID_JSON');
  }
}

export async function readBoundedJsonObject(
  request: Request,
  maxBytes: number,
): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0];
  if (contentType !== 'application/json') {
    throw new ApiError(415, 'Content-Type must be application/json', 'UNSUPPORTED_MEDIA_TYPE');
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ApiError(413, 'Request body is too large', 'REQUEST_TOO_LARGE');
  }
  if (!request.body) {
    throw new ApiError(400, 'Request body must be a JSON object', 'INVALID_JSON');
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new ApiError(413, 'Request body is too large', 'REQUEST_TOO_LARGE');
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const body: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'Request body must be a JSON object', 'INVALID_JSON');
  }
}

export function apiErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  console.error(error);
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed' } },
    { status: 500 },
  );
}

export function validateUsername(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ApiError(400, 'Username is required', 'INVALID_USERNAME');
  }
  const username = value.trim();
  if (!/^[A-Za-z0-9._-]{3,64}$/.test(username)) {
    throw new ApiError(
      400,
      'Username must be 3-64 characters using letters, numbers, dot, underscore, or hyphen',
      'INVALID_USERNAME',
    );
  }
  return username;
}

export function normalizeUsername(username: string): string {
  return username.toLocaleLowerCase('en-US');
}

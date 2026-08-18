import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { apiErrorResponse } from '@/lib/api';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const [users, user] = await Promise.all([
      query<{ count: string }>('SELECT count(*)::text AS count FROM users'),
      getAuthenticatedUser(request),
    ]);
    return NextResponse.json({
      setupRequired: Number(users.rows[0].count) === 0,
      authenticated: Boolean(user),
      user,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

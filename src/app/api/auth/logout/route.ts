import { NextRequest, NextResponse } from 'next/server';
import {
  clearSessionCookie,
  getAuthenticatedUser,
  revokeSession,
  SESSION_COOKIE,
} from '@/lib/auth/session';
import { apiErrorResponse, assertSameOrigin } from '@/lib/api';
import { recordAuditSafely } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await getAuthenticatedUser(request);
    await revokeSession(request.cookies.get(SESSION_COOKIE)?.value);
    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);
    if (user) {
      recordAuditSafely({
        actorId: user.id,
        action: 'auth.logout',
        resourceType: 'session',
        success: true,
      });
    }
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}

import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'ekuiper_manager_session';

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/health/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/welcome' ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL('/welcome', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};

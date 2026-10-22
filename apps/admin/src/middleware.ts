import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('scanflow_admin')?.value;
  const isLogin = request.nextUrl.pathname.startsWith('/login');
  const isSession = request.nextUrl.pathname.startsWith('/api/session');
  if (!token && !isLogin && !isSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (token && isLogin) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

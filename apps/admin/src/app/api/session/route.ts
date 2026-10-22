import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await request.json()) as { token?: string };
    if (!body.token) return NextResponse.json({ ok: false }, { status: 400 });
    const response = NextResponse.json({ ok: true });
    response.cookies.set('scanflow_admin', body.token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 15,
    });
    return response;
  }
  const form = await request.formData();
  if (form.get('intent') === 'logout') {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('scanflow_admin');
    return response;
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}

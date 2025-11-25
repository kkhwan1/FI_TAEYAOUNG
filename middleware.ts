import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  console.log('[MIDDLEWARE] === Processing request:', pathname);

  // 정적 파일 제외
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/images')
  ) {
    console.log('[MIDDLEWARE] Static file - allowing');
    return NextResponse.next();
  }

  // 로그인 페이지는 인증 체크를 하지 않음
  if (pathname === '/login' || pathname.startsWith('/api/auth')) {
    console.log('[MIDDLEWARE] Login/API auth route - allowing');
    return NextResponse.next();
  }

  // 기타 API 라우트는 제외 (자체 인증 체크 수행)
  if (pathname.startsWith('/api')) {
    console.log('[MIDDLEWARE] API route - allowing (will check auth internally)');
    return NextResponse.next();
  }

  // 개발 환경에서 인증 우회 옵션 (환경 변수로 제어)
  const bypassAuth = process.env.BYPASS_AUTH === 'true' || process.env.NODE_ENV === 'development';
  const devUserId = process.env.DEV_USER_ID;

  if (bypassAuth && devUserId) {
    console.log('[MIDDLEWARE] Development mode: Bypassing auth with DEV_USER_ID:', devUserId);
    // 개발용 user_id 쿠키 설정
    const response = NextResponse.next();
    if (!request.cookies.get('user_id')) {
      response.cookies.set('user_id', devUserId, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
      });
      console.log('[MIDDLEWARE] Set dev user_id cookie:', devUserId);
    }
    return response;
  }

  // 페이지 라우트는 인증 체크
  console.log('[MIDDLEWARE] Checking authentication for page:', pathname);
  const user = await getCurrentUser(request);
  console.log('[MIDDLEWARE] User:', user ? `${user.username} (${user.role})` : 'not authenticated');

  if (!user) {
    console.log('[MIDDLEWARE] No user - redirecting to /login');
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  console.log('[MIDDLEWARE] Authenticated - allowing');
  return NextResponse.next();
}

// Force Node.js runtime to prevent Edge Runtime issues during build
export const runtime = 'nodejs';

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api routes (handled separately in middleware)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
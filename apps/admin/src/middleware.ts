import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Admin pages that require authentication
const PROTECTED_PATHS = [
  '/dashboard',
  '/tenants',
  '/subscriptions',
  '/plans',
  '/invoices',
  '/system',
  '/analytics',
  '/backups',
  '/audit-logs',
  '/notifications',
  '/settings',
  '/features',
  '/users',
];

const PUBLIC_PATHS = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let static files and API calls pass through
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/sw.js') ||
    pathname.startsWith('/manifest.json') ||
    pathname.startsWith('/icon-') ||
    pathname.endsWith('.ico')
  ) {
    return NextResponse.next();
  }

  // Check for auth cookie/token
  // Since we use zustand persist (localStorage), we use a cookie bridge
  const authCookie = request.cookies.get('servix-admin-auth');
  let isAuthenticated = false;

  if (authCookie?.value) {
    try {
      const parsed = JSON.parse(authCookie.value);
      isAuthenticated = !!(parsed?.state?.accessToken && parsed?.state?.user);
    } catch {
      isAuthenticated = false;
    }
  }

  // Protected route — redirect to login if not authenticated
  const isProtected = PROTECTED_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Login page — redirect to dashboard if already authenticated
  if (PUBLIC_PATHS.includes(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Root path → redirect
  if (pathname === '/') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

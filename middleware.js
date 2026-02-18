import { NextResponse } from 'next/server';
import { verifySession } from './lib/auth';

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/offline',
];

const PUBLIC_API_PATHS = [
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/cron/process-schedules',
];

// Paths accessible when logged in but unverified
const VERIFY_ALLOWED_PATHS = [
  '/verify-email',
];

const VERIFY_ALLOWED_API_PATHS = [
  '/api/auth/verify-email',
  '/api/auth/resend-verification',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/auth/profile',
  '/api/upload',
];

// Role-based page prefixes
const ROLE_PREFIXES = {
  '/admin': 'admin',
  '/client': 'client',
  '/driver': 'driver',
};

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Public pages — no auth required
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // Public API routes — no auth required
  if (PUBLIC_API_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // GET /api/admin/settings is public (commission rate)
  if (pathname === '/api/admin/settings' && request.method === 'GET') {
    return NextResponse.next();
  }

  // Read session cookie
  const token = request.cookies.get('session')?.value;
  const session = token ? await verifySession(token) : null;

  const isApiRoute = pathname.startsWith('/api/');

  if (!session) {
    if (isApiRoute) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Email verification enforcement
  if (!session.isVerified) {
    // Always allow verification-related API paths
    if (VERIFY_ALLOWED_API_PATHS.includes(pathname)) {
      // Fall through to set headers below
    } else if (VERIFY_ALLOWED_PATHS.includes(pathname)) {
      // Allow verify-email page — fall through
    } else if (isApiRoute) {
      // Block other API routes for unverified users
      return NextResponse.json({ error: 'Email not verified' }, { status: 403 });
    } else {
      // Redirect unverified users to verify-email page
      const verifyUrl = new URL('/verify-email', request.url);
      return NextResponse.redirect(verifyUrl);
    }
  }

  // Role-based page protection (only for verified users on role-prefixed pages)
  if (!isApiRoute && session.isVerified) {
    for (const [prefix, requiredRole] of Object.entries(ROLE_PREFIXES)) {
      if (pathname.startsWith(prefix) && session.role !== requiredRole) {
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  // Set session headers on the request for API routes to read
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', session.userId);
  requestHeaders.set('x-user-role', session.role);
  requestHeaders.set('x-user-email', session.email);
  requestHeaders.set('x-user-verified', String(session.isVerified));

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/.*|sw.js|manifest.json).*)',
  ],
};

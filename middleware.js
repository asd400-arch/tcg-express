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
  '/api/stripe/webhook',
  '/api/external/orders',
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

// Allowed origins for CSRF validation
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL,
  process.env.NEXT_PUBLIC_APP_URL,
  'https://tcgexpress.sg',
  'https://www.tcgexpress.sg',
  'https://tcg-express.vercel.app',
  'https://app.techchainglobal.com',
  'https://express.techchainglobal.com',
].filter(Boolean);

function isAllowedOrigin(url) {
  if (!url) return false;
  // Exact match or startsWith for configured origins
  if (ALLOWED_ORIGINS.some(ao => url.startsWith(ao))) return true;
  // Allow any *.vercel.app preview/deployment URL
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app/i.test(url)) return true;
  // Allow localhost / 127.0.0.1 (any port) in development
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(url)) return true;
  return false;
}

function checkOrigin(request) {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  // Mobile apps send Bearer tokens and no origin — allow them
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return true;
  // Stripe webhooks have no origin
  if (request.headers.get('stripe-signature')) return true;
  // No origin/referer: allow (mobile browsers, server-side, cron, etc.)
  if (!origin && !referer) return true;
  // Check origin header first
  if (origin) return isAllowedOrigin(origin);
  // Fall back to referer
  if (referer) return isAllowedOrigin(referer);
  return true;
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Domain redirect: express.techchainglobal.com → app.techchainglobal.com
  const host = request.headers.get('host') || '';
  if (host === 'express.techchainglobal.com') {
    const url = request.nextUrl.clone();
    url.host = 'app.techchainglobal.com';
    return NextResponse.redirect(url, 301);
  }

  // /driver/register → /signup?role=driver
  if (pathname === '/driver/register') {
    const signupUrl = new URL('/signup', request.url);
    signupUrl.searchParams.set('role', 'driver');
    return NextResponse.redirect(signupUrl, 301);
  }

  // /id/* 경로 → locale 쿠키 세팅
  if (pathname.startsWith('/id')) {
    const response = NextResponse.next();
    response.cookies.set('locale', 'id', { path: '/', maxAge: 60 * 60 * 24 * 365 });
    return response;
  }
  if (pathname.startsWith('/sg')) {
    const response = NextResponse.next();
    response.cookies.set('locale', 'sg', { path: '/', maxAge: 60 * 60 * 24 * 365 });
    return response;
  }

  // Public pages — no auth required
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // Public API routes — no auth required (skip CSRF for login/signup/etc.)
  if (PUBLIC_API_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // CSRF: validate Origin/Referer on state-changing API requests (after public paths bypass)
  if (pathname.startsWith('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    if (!checkOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden: invalid origin' }, { status: 403 });
    }
  }

  // GET /api/admin/settings is public (commission rate)
  if (pathname === '/api/admin/settings' && request.method === 'GET') {
    return NextResponse.next();
  }

  // Read session from cookie or Authorization header (mobile)
  const cookieToken = request.cookies.get('session')?.value;
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = cookieToken || bearerToken;
  const session = token ? await verifySession(token) : null;

  const isApiRoute = pathname.startsWith('/api/');

  if (!session) {
    if (isApiRoute) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
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
    '/((?!_next/static|_next/image|favicon.ico|icons/.*|sw.js|manifest.json|.*\\.png$|.*\\.svg$).*)',
  ],
};

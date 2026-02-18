import { SignJWT, jwtVerify } from 'jose';

const SESSION_SECRET = process.env.SESSION_SECRET;
const COOKIE_NAME = 'session';
const EXPIRY = '7d';

function getSecretKey() {
  if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET must be set and at least 32 characters');
  }
  return new TextEncoder().encode(SESSION_SECRET);
}

export async function createSession(user) {
  const token = await new SignJWT({
    userId: user.id,
    role: user.role,
    email: user.email,
    isVerified: !!user.is_verified,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecretKey());
  return token;
}

export function setSessionCookie(response, token) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
  return response;
}

export function clearSessionCookie(response) {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}

export async function verifySession(token) {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return { userId: payload.userId, role: payload.role, email: payload.email, isVerified: !!payload.isVerified };
  } catch {
    return null;
  }
}

export function getSession(request) {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  const email = request.headers.get('x-user-email');
  const isVerified = request.headers.get('x-user-verified') === 'true';
  if (!userId) return null;
  return { userId, role, email, isVerified };
}

export function requireAuth(request) {
  const session = getSession(request);
  if (!session) {
    return { error: 'Unauthorized', status: 401 };
  }
  return { session };
}

export function requireAdmin(request) {
  const session = getSession(request);
  if (!session) {
    return { error: 'Unauthorized', status: 401 };
  }
  if (session.role !== 'admin') {
    return { error: 'Forbidden', status: 403 };
  }
  return { session };
}

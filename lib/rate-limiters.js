import { rateLimit } from './rate-limit';
import { NextResponse } from 'next/server';

// Pre-configured rate limiters for different endpoint categories
export const rateLimiters = {
  // Auth: 5 per minute per identifier (IP or email)
  auth: rateLimit({ interval: 60 * 1000, maxRequests: 5, name: 'auth' }),
  // Payment: 10 per minute per user
  payment: rateLimit({ interval: 60 * 1000, maxRequests: 10, name: 'payment' }),
  // Upload: 20 per minute per user
  upload: rateLimit({ interval: 60 * 1000, maxRequests: 20, name: 'upload' }),
  // General API: 100 per minute per user
  general: rateLimit({ interval: 60 * 1000, maxRequests: 100, name: 'general' }),
  // Bids: 20 per minute per user (prevent spam bidding)
  bids: rateLimit({ interval: 60 * 1000, maxRequests: 20, name: 'bids' }),
  // Notifications: 30 per minute per user
  notifications: rateLimit({ interval: 60 * 1000, maxRequests: 30, name: 'notifications' }),
};

/**
 * Apply rate limiting. Returns a 429 response if rate exceeded, or null if OK.
 * Usage: const blocked = applyRateLimit(rateLimiters.payment, session.userId); if (blocked) return blocked;
 */
export function applyRateLimit(limiter, identifier) {
  if (!identifier) return null;
  const { success, remaining } = limiter.check(identifier);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': '60', 'X-RateLimit-Remaining': '0' } }
    );
  }
  return null;
}

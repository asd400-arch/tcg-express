import { NextResponse } from 'next/server';
import { getSession } from '../../../../../lib/auth';
import { rateLimiters, applyRateLimit } from '../../../../../lib/rate-limiters';
import { requireUUID } from '../../../../../lib/validate';
import { releaseAssignedDriver } from '../../../../../lib/dispatch';

/**
 * POST /api/jobs/[id]/release
 * Release the assigned driver before pickup (driver no-show, driver backed out, or customer cancels).
 *
 * body: {
 *   action: 'reopen' | 'cancel',        // reopen = find another driver, cancel = cancel the job
 *   reason?: 'no_show' | 'driver_cancelled' | 'customer',   // default 'no_show'
 *   pickup_by?: ISO string               // reopen only: new pickup time (15 min – 14 days ahead)
 * }
 *
 * Refunds what the customer paid (wallet, or Stripe when the job was card-paid), rejects the
 * driver's bid, tells the driver, and records no-shows in job_review_flags so admins can see
 * repeat offenders. On reopen, the other drivers are alerted again.
 * Only for status 'assigned' — once the goods are picked up this path is closed (use a dispute).
 * The same logic runs automatically from the dispatch sweep (lib/dispatch.js).
 */

const REASONS = ['no_show', 'driver_cancelled', 'customer'];

export async function POST(request, { params }) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['client', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Only the customer or an admin can release a driver' }, { status: 403 });
    }

    const blocked = applyRateLimit(rateLimiters.payment, session.userId);
    if (blocked) return blocked;

    const { id } = await params;
    const idCheck = requireUUID(id, 'Job ID');
    if (idCheck.error) return NextResponse.json({ error: idCheck.error }, { status: 400 });

    let body = {};
    try { body = await request.json(); } catch { /* empty body */ }
    const action = body?.action === 'cancel' ? 'cancel' : body?.action === 'reopen' ? 'reopen' : null;
    if (!action) return NextResponse.json({ error: 'action must be "reopen" or "cancel"' }, { status: 400 });
    const reason = REASONS.includes(body?.reason) ? body.reason : 'no_show';

    let newPickupIso = null;
    if (action === 'reopen' && body?.pickup_by) {
      const t = new Date(body.pickup_by).getTime();
      const now = Date.now();
      if (!Number.isFinite(t) || t < now + 15 * 60 * 1000 || t > now + 14 * 24 * 3600 * 1000) {
        return NextResponse.json({ error: 'Choose a pickup time at least 15 minutes from now' }, { status: 400 });
      }
      newPickupIso = new Date(t).toISOString();
    }

    const result = await releaseAssignedDriver({
      jobId: idCheck.value,
      action,
      reason,
      newPickupIso,
      actorRole: session.role,
      actorId: session.userId,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ data: result.data });
  } catch (err) {
    console.error('POST /api/jobs/[id]/release error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

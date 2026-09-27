import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { getSession } from '../../../../../lib/auth';
import { rateLimiters, applyRateLimit } from '../../../../../lib/rate-limiters';
import { requireUUID } from '../../../../../lib/validate';
import { getAreaName } from '../../../../../lib/job-helpers';
import { isQuoteJob, driverPrice, BOOST_OPTIONS, BOOST_CAP } from '../../../../../lib/pricing-mode';
import { alertDriversAboutJob, isSchemaMissing, sgTime } from '../../../../../lib/dispatch';

/**
 * POST /api/jobs/[id]/boost   body: { amount: 3 | 5 | 8 }
 * The customer adds to the fixed price of a job nobody has accepted yet; drivers are alerted
 * again with the new price. Paid by the customer when a driver accepts (all of it goes to the
 * driver's price). Up to S$20 per job. Quote jobs can't be boosted — drivers set their own price.
 */
export async function POST(request, { params }) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'client') {
      return NextResponse.json({ error: 'Only the customer can raise the price' }, { status: 403 });
    }

    const blocked = applyRateLimit(rateLimiters.payment, session.userId);
    if (blocked) return blocked;

    const { id } = await params;
    const idCheck = requireUUID(id, 'Job ID');
    if (idCheck.error) return NextResponse.json({ error: idCheck.error }, { status: 400 });
    const jobId = idCheck.value;

    let body = {};
    try { body = await request.json(); } catch { /* empty */ }
    const amount = Number(body?.amount);
    if (!BOOST_OPTIONS.includes(amount)) {
      return NextResponse.json({ error: `Choose one of: ${BOOST_OPTIONS.map((a) => `S$${a}`).join(', ')}` }, { status: 400 });
    }

    const { data: job, error: jobErr } = await supabaseAdmin
      .from('express_jobs')
      .select('id, client_id, status, job_number, budget_min, budget_max, coupon_discount, boost_total, vehicle_required, equipment_needed, pickup_by, pickup_address, delivery_address, item_description')
      .eq('id', jobId)
      .single();
    if (jobErr && isSchemaMissing(jobErr)) {
      return NextResponse.json({ error: 'This feature is being switched on — please try again shortly.' }, { status: 503 });
    }
    if (jobErr || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (job.client_id !== session.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!['open', 'bidding'].includes(job.status)) {
      return NextResponse.json({ error: 'A driver has already taken this job.' }, { status: 409 });
    }
    if (isQuoteJob(job)) {
      return NextResponse.json({ error: 'This job takes quotes — drivers set their own price.' }, { status: 400 });
    }

    const r2 = (v) => Math.round(v * 100) / 100;
    const current = Math.max(0, parseFloat(job.boost_total) || 0);
    if (current + amount > BOOST_CAP) {
      return NextResponse.json({ error: `You can add up to S$${BOOST_CAP} in total (S$${current} added so far).` }, { status: 400 });
    }
    const oldMin = parseFloat(job.budget_min) || 0;
    const newMin = r2(oldMin + amount);
    const newMax = r2(Math.max(parseFloat(job.budget_max) || 0, oldMin) + amount);

    // The customer must be able to pay the new price when a driver accepts
    const { data: wallet } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', session.userId).single();
    const balance = parseFloat(wallet?.balance) || 0;
    if (balance < newMin) {
      return NextResponse.json({
        error: 'Top up your wallet to raise the price.',
        available: balance.toFixed(2),
        required: newMin.toFixed(2),
      }, { status: 400 });
    }

    // Guard on the old price so a double tap can't add twice
    const { data: updated, error: updErr } = await supabaseAdmin
      .from('express_jobs')
      .update({ budget_min: newMin, budget_max: newMax, boost_total: r2(current + amount) })
      .eq('id', jobId)
      .in('status', ['open', 'bidding'])
      .eq('budget_min', job.budget_min)
      .select('id, job_number, status, budget_min, budget_max, coupon_discount, boost_total, vehicle_required, equipment_needed, pickup_by, pickup_address, delivery_address, item_description')
      .maybeSingle();
    if (updErr) {
      if (isSchemaMissing(updErr)) {
        return NextResponse.json({ error: 'This feature is being switched on — please try again shortly.' }, { status: 503 });
      }
      console.error('[boost] update failed:', updErr.message);
      return NextResponse.json({ error: 'Could not update the price. Please try again.' }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: 'The job just changed — refresh and try again.' }, { status: 409 });
    }

    // Alert drivers again with the new price (app only)
    const price = driverPrice(updated);
    try {
      const route = `${getAreaName(updated.pickup_address)} → ${getAreaName(updated.delivery_address)}`;
      await alertDriversAboutJob(updated, {
        title: `💰 Price up: S$${price.toFixed(2)} — ${updated.job_number}`,
        body: `${route}${updated.pickup_by ? ` | pickup ${sgTime(updated.pickup_by)}` : ''} | first to accept gets it`,
        inAppTitle: `Price up to S$${price.toFixed(2)}: ${(updated.item_description || 'Delivery').substring(0, 45)}`,
        inAppBody: `Job #${updated.job_number} — ${route}. First driver to accept gets it.`,
      });
    } catch (e) {
      console.error('[boost] re-alert failed:', e?.message);
    }

    return NextResponse.json({
      data: {
        jobId,
        budget_min: newMin,
        boost_total: r2(current + amount),
        driver_price: price,
      },
    });
  } catch (err) {
    console.error('POST /api/jobs/[id]/boost error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

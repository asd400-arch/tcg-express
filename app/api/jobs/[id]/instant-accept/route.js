import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { getSession } from '../../../../../lib/auth';
import { notify } from '../../../../../lib/notify';
import { checkVehicleFit } from '../../../../../lib/fares';
import { buildPaymentsBreakdown } from '../../../../../lib/bid-breakdown';

// POST: Driver instantly accepts job at customer's max budget
// Uses atomic process_bid_acceptance RPC — all-or-nothing
export async function POST(request, { params }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const session = getSession(request);
    if (!session) {
      console.error('[instant-accept] No session — returning 401');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.role !== 'driver') {
      console.error('[instant-accept] Not a driver:', session.role);
      return NextResponse.json({ error: 'Only drivers can accept jobs' }, { status: 403 });
    }

    const { id: jobId } = await params;

    if (!jobId) {
      console.error('[instant-accept] jobId is empty/undefined from params');
      return NextResponse.json({ error: 'Missing job ID' }, { status: 400 });
    }

    // Fetch job to get budget and client_id
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('express_jobs')
      .select('id, client_id, status, job_number, budget_max, budget_min, vehicle_required, fare_breakdown, coupon_discount, equipment_needed')
      .eq('id', jobId)
      .single();

    if (jobErr || !job) {
      console.error('[instant-accept] Job query failed:', {
        jobId,
        driverId: session.userId,
        error: jobErr?.message,
        code: jobErr?.code,
        details: jobErr?.details,
        hint: jobErr?.hint,
        jobData: job,
      });
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    if (!['open', 'bidding'].includes(job.status)) {
      console.warn(`[instant-accept] Job ${job.job_number} status is ${job.status} — not accepting bids`);
      return NextResponse.json({ error: `Job is no longer accepting bids (status: ${job.status})` }, { status: 400 });
    }

    // Block instant-accept for jobs requiring driver-quoted dismantling/assembly
    const QUOTED_KEYS = ['dismantlement', 'installation'];
    const requiresQuote = Array.isArray(job.equipment_needed) &&
      job.equipment_needed.some(k => QUOTED_KEYS.includes(k));
    if (requiresQuote) {
      console.warn(`[instant-accept] Job ${job.job_number} requires quoted bid (dismantling/assembly)`);
      return NextResponse.json(
        { error: 'This job requires a quoted bid for dismantling/assembly services' },
        { status: 400 }
      );
    }

    // Vehicle size validation: driver's vehicle must be big enough
    if (job.vehicle_required && job.vehicle_required !== 'any') {
      const { data: driver } = await supabaseAdmin
        .from('express_users')
        .select('vehicle_type')
        .eq('id', session.userId)
        .single();

      const fit = checkVehicleFit(driver?.vehicle_type, job.vehicle_required);
      if (!fit.ok) {
        return NextResponse.json({
          error: `Your vehicle is too small for this job. Required: ${fit.required}`,
        }, { status: 400 });
      }
    }

    const bidAmount = parseFloat(job.budget_min) || parseFloat(job.budget_max);
    if (!bidAmount || !isFinite(bidAmount) || bidAmount <= 0) {
      console.error(`[instant-accept] No valid budget for job ${job.job_number}`);
      return NextResponse.json({ error: 'Job has no valid budget or estimated fare' }, { status: 400 });
    }

    // Create or update bid first (separate from atomic payment)
    let bid;
    const { data: existingBid } = await supabaseAdmin
      .from('express_bids')
      .select('id, amount, status, message')
      .eq('job_id', jobId)
      .eq('driver_id', session.userId)
      .in('status', ['pending'])
      .single();

    if (existingBid) {
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('express_bids')
        .update({ amount: bidAmount, message: 'Instant accept at posted budget' })
        .eq('id', existingBid.id)
        .select()
        .single();
      if (updateErr) {
        console.error('[instant-accept] Bid update failed:', updateErr.message);
        return NextResponse.json({ error: 'Failed to update bid' }, { status: 500 });
      }
      bid = updated;
    } else {
      const { data: newBid, error: bidErr } = await supabaseAdmin
        .from('express_bids')
        .insert([{
          job_id: jobId,
          driver_id: session.userId,
          amount: bidAmount,
          message: 'Instant accept at posted budget',
          status: 'pending',
        }])
        .select()
        .single();
      if (bidErr) {
        if (bidErr.code === '23505') {
          return NextResponse.json({ error: 'You already placed a bid on this job. Please try again.' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Failed to create bid' }, { status: 500 });
      }
      bid = newBid;
    }

    // Get commission rate
    let rate = 15;
    try {
      const { data: settings } = await supabaseAdmin.from('express_settings').select('value').eq('key', 'commission_rate').single();
      if (settings?.value) rate = parseFloat(settings.value);
    } catch {}

    // Idempotency key
    const idempotencyKey = `instant_${jobId}_${bid.id}`;

    // ATOMIC: single RPC call does wallet debit + bid accept + job assign + escrow
    const { data: result, error: rpcErr } = await supabaseAdmin.rpc('process_bid_acceptance', {
      p_job_id: jobId,
      p_bid_id: bid.id,
      p_payer_id: job.client_id,
      p_commission_rate: rate,
      p_coupon_discount: 0,
      p_coupon_id: null,
      p_idempotency_key: idempotencyKey,
    });

    if (rpcErr) {
      const msg = rpcErr.message || '';
      console.error('[instant-accept] RPC failed:', { msg, code: rpcErr?.code, jobId, bidId: bid.id, payerId: job.client_id });
      // Revert bid on payment failure
      if (existingBid) {
        await supabaseAdmin.from('express_bids')
          .update({ amount: existingBid.amount, message: existingBid.message })
          .eq('id', bid.id);
      } else {
        await supabaseAdmin.from('express_bids').delete().eq('id', bid.id);
      }

      if (msg.includes('Insufficient balance')) {
        // Notify client about low balance — don't expose details to driver
        try {
          await notify(job.client_id, {
            type: 'wallet', category: 'payment',
            title: 'Insufficient wallet balance',
            message: `A driver tried to accept ${job.job_number} but your wallet balance is too low. Please top up your wallet.`,
            referenceId: jobId,
            data: { job_id: jobId, role: 'client' },
          });
        } catch {}
        return NextResponse.json({ error: 'This job cannot be accepted right now. Please try another job.' }, { status: 400 });
      }
      if (msg.includes('no longer accepting') || msg.includes('no longer pending')) {
        return NextResponse.json({ error: 'This job is no longer available' }, { status: 409 });
      }
      console.error('instant-accept RPC error:', msg);
      return NextResponse.json({ error: 'Failed to process acceptance. Please try again.' }, { status: 500 });
    }

    // Handle idempotent re-request
    if (result?.already_processed) {
      return NextResponse.json({ success: true, payout: '0.00', note: 'Already processed' });
    }

    // Promote inquiry thread → job_chat (non-fatal)
    try {
      const { promoteInquiry } = await import('../../../../../lib/promote-inquiry.js');
      await promoteInquiry(jobId, session.userId);
    } catch (e) {
      console.error('[instant-accept] promoteInquiry error:', e);
    }

    // Create payments record with fare breakdown (non-fatal)
    try {
      const { data: clientTx } = await supabaseAdmin
        .from('wallet_transactions')
        .select('id')
        .eq('user_id', job.client_id)
        .eq('reference_type', 'job')
        .eq('reference_id', jobId)
        .eq('type', 'payment')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // instant-accept: no driver breakdown (bid auto-created at budget price)
      const breakdown = buildPaymentsBreakdown(null, job.fare_breakdown, job.coupon_discount);

      await supabaseAdmin.from('payments').insert({
        job_id:               jobId,
        customer_id:          job.client_id,
        driver_id:            session.userId,
        total_amount:         bidAmount,
        platform_commission:  result.commission,
        driver_earning:       result.payout,
        commission_rate:      rate,
        ...breakdown,
        payment_method:       'wallet',
        payment_status:       'paid',
        customer_wallet_tx_id: clientTx?.id || null,
        paid_at:              new Date().toISOString(),
      });
    } catch (pmtErr) {
      console.error('[instant-accept] payments insert failed (non-fatal):', pmtErr?.message);
    }

    // Notify client (non-critical)
    try {
      const { data: driver } = await supabaseAdmin
        .from('express_users')
        .select('contact_name, vehicle_type, vehicle_plate, driver_rating')
        .eq('id', session.userId)
        .single();

      await notify(job.client_id, {
        type: 'job', category: 'bid_activity',
        title: `Driver accepted ${job.job_number} instantly!`,
        message: `${driver?.contact_name || 'A driver'} accepted your job at $${bidAmount.toFixed(2)}. Payment processed from wallet.`,
        referenceId: jobId,
        data: { job_id: jobId, role: 'client' },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      bid: { id: bid.id, amount: bidAmount },
      payout: parseFloat(result.payout).toFixed(2),
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timed out' }, { status: 504 });
    }
    console.error('POST /api/jobs/[id]/instant-accept error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }
}

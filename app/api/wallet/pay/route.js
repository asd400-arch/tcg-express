import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';
import { notify } from '../../../../lib/notify';
import { rateLimiters, applyRateLimit } from '../../../../lib/rate-limiters';
import { requireUUID, validateAll, cleanString } from '../../../../lib/validate';

// Pay for a job using wallet balance + optional promo code
// Uses atomic process_bid_acceptance RPC — all-or-nothing
export async function POST(request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'client') return NextResponse.json({ error: 'Only clients can pay' }, { status: 403 });

    const blocked = applyRateLimit(rateLimiters.payment, session.userId);
    if (blocked) return blocked;

    const body = await request.json();
    const { error: vErr, values: v } = validateAll(
      ['jobId', requireUUID(body.jobId, 'Job ID')],
      ['bidId', requireUUID(body.bidId, 'Bid ID')],
    );
    if (vErr) return NextResponse.json({ error: vErr }, { status: 400 });
    const { jobId, bidId } = v;
    const couponCode = cleanString(body.couponCode, 50);

    // Resolve coupon discount if provided
    let couponDiscount = 0;
    let couponId = null;

    if (couponCode) {
      try {
        const { data: promo } = await supabaseAdmin
          .from('promo_codes')
          .select('*')
          .eq('code', couponCode.toUpperCase())
          .eq('is_active', true)
          .single();

        if (promo) {
          const { data: bid } = await supabaseAdmin.from('express_bids').select('amount').eq('id', bidId).single();
          const totalAmount = parseFloat(bid?.amount || 0);
          const now = new Date();
          const expired = promo.valid_until && new Date(promo.valid_until) < now;
          const notStarted = promo.valid_from && new Date(promo.valid_from) > now;
          const maxedOut = promo.usage_limit && promo.usage_count >= promo.usage_limit;
          const belowMin = promo.min_order_amount && totalAmount < parseFloat(promo.min_order_amount);

          if (!expired && !notStarted && !maxedOut && !belowMin) {
            if (promo.discount_type === 'percentage') {
              couponDiscount = totalAmount * (parseFloat(promo.discount_value) / 100);
              if (promo.max_discount) couponDiscount = Math.min(couponDiscount, parseFloat(promo.max_discount));
            } else {
              couponDiscount = parseFloat(promo.discount_value);
            }
            couponDiscount = Math.min(couponDiscount, totalAmount);
            couponId = promo.id;
          }
        }
      } catch {}
    }

    // Get commission rate
    let rate = 15;
    try {
      const { data: settings } = await supabaseAdmin.from('express_settings').select('value').eq('key', 'commission_rate').single();
      if (settings?.value) rate = parseFloat(settings.value);
    } catch {}

    // Generate idempotency key from job+bid combo
    const idempotencyKey = `pay_${jobId}_${bidId}`;

    // ATOMIC: single RPC call does wallet debit + bid accept + job assign + escrow
    const { data: result, error: rpcErr } = await supabaseAdmin.rpc('process_bid_acceptance', {
      p_job_id: jobId,
      p_bid_id: bidId,
      p_payer_id: session.userId,
      p_commission_rate: rate,
      p_coupon_discount: couponDiscount,
      p_coupon_id: couponId,
      p_idempotency_key: idempotencyKey,
    });

    if (rpcErr) {
      const msg = rpcErr.message || '';
      console.error('[wallet/pay] RPC error:', { msg, jobId, bidId, userId: session.userId, couponDiscount, idempotencyKey });
      if (msg.includes('Job not found')) {
        // Additional diagnostic: check if job and bid actually exist
        const [jobCheck, bidCheck] = await Promise.all([
          supabaseAdmin.from('express_jobs').select('id, status, client_id').eq('id', jobId).maybeSingle(),
          supabaseAdmin.from('express_bids').select('id, status, job_id, driver_id').eq('id', bidId).maybeSingle(),
        ]);
        console.error('[wallet/pay] Diagnostic — Job exists:', !!jobCheck.data, 'status:', jobCheck.data?.status, 'client:', jobCheck.data?.client_id);
        console.error('[wallet/pay] Diagnostic — Bid exists:', !!bidCheck.data, 'status:', bidCheck.data?.status, 'bid.job_id:', bidCheck.data?.job_id, 'matches jobId:', bidCheck.data?.job_id === jobId);
      }
      if (msg.includes('Insufficient balance')) {
        // Extract amounts from error message
        const match = msg.match(/Available: ([0-9.]+), Required: ([0-9.]+)/);
        return NextResponse.json({
          error: 'Insufficient wallet balance',
          available: match ? match[1] : '0.00',
          required: match ? match[2] : '0.00',
        }, { status: 400 });
      }
      if (msg.includes('no longer accepting') || msg.includes('no longer pending')) {
        return NextResponse.json({ error: 'This bid is no longer available' }, { status: 409 });
      }
      console.error('process_bid_acceptance RPC error:', msg);
      return NextResponse.json({ error: 'Payment processing failed. Please try again.' }, { status: 500 });
    }

    // Handle idempotent re-request
    if (result?.already_processed) {
      return NextResponse.json({ success: true, payment: { note: 'Already processed' } });
    }

    // Increment promo code usage (non-critical)
    if (couponId) {
      try {
        const { data: promo } = await supabaseAdmin.from('promo_codes').select('usage_count').eq('id', couponId).single();
        if (promo) await supabaseAdmin.from('promo_codes').update({ usage_count: (promo.usage_count || 0) + 1 }).eq('id', couponId);
      } catch {}
    }

    // Notifications (non-critical, fire-and-forget)
    try {
      const [driverRes, clientRes] = await Promise.all([
        supabaseAdmin.from('express_users').select('contact_name, phone, vehicle_type, vehicle_plate, driver_rating').eq('id', result.driver_id).single(),
        supabaseAdmin.from('express_users').select('contact_name, phone, company_name').eq('id', session.userId).single(),
      ]);
      const driver = driverRes.data;
      const client = clientRes.data;
      const jobNumber = result.job_number || '';

      await Promise.all([
        notify(result.driver_id, {
          type: 'job', category: 'bid_activity',
          title: `Job ${jobNumber} assigned to you!`,
          message: `Your bid of $${parseFloat(result.bid_amount).toFixed(2)} has been accepted.${client ? `\nClient: ${client.contact_name}${client.phone ? ` (${client.phone})` : ''}` : ''}`,
          referenceId: jobId,
        }),
        notify(session.userId, {
          type: 'job', category: 'job_updates',
          title: `Driver assigned for ${jobNumber}`,
          message: `${driver?.contact_name || 'A driver'} has been assigned ($${parseFloat(result.bid_amount).toFixed(2)}).`,
          referenceId: jobId,
        }),
      ]);
    } catch {}

    return NextResponse.json({
      success: true,
      payment: {
        total: parseFloat(result.bid_amount).toFixed(2),
        couponDiscount: couponDiscount.toFixed(2),
        finalPaid: parseFloat(result.final_paid).toFixed(2),
        walletBalance: parseFloat(result.wallet_balance).toFixed(2),
      },
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timed out. Please check your payment status before retrying.' }, { status: 504 });
    }
    console.error('Wallet pay error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }
}

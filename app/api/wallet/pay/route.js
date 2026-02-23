import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';
import { notify } from '../../../../lib/notify';

// Pay for a job using wallet balance + optional promo code & points
export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'client') return NextResponse.json({ error: 'Only clients can pay' }, { status: 403 });

    const { jobId, bidId, couponCode, usePoints } = await request.json();
    if (!jobId || !bidId) return NextResponse.json({ error: 'jobId and bidId required' }, { status: 400 });

    // Fetch bid
    const { data: bid } = await supabaseAdmin
      .from('express_bids')
      .select('id, job_id, driver_id, amount, status')
      .eq('id', bidId)
      .single();

    if (!bid || bid.status !== 'pending') return NextResponse.json({ error: 'Bid not found or not pending' }, { status: 404 });

    // Fetch job
    const { data: job } = await supabaseAdmin
      .from('express_jobs')
      .select('id, client_id, status, job_number')
      .eq('id', jobId)
      .single();

    if (!job || job.client_id !== session.userId) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (!['open', 'bidding'].includes(job.status)) return NextResponse.json({ error: 'Job not accepting bids' }, { status: 400 });

    let totalAmount = parseFloat(bid.amount);
    let couponDiscount = 0;
    let pointsDiscount = 0;
    let pointsUsed = 0;
    let couponId = null;

    // Apply promo code if provided (uses promo_codes table)
    if (couponCode) {
      try {
        const { data: promo } = await supabaseAdmin
          .from('promo_codes')
          .select('*')
          .eq('code', couponCode.toUpperCase())
          .eq('is_active', true)
          .single();

        if (promo) {
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

    let amountAfterCoupon = totalAmount - couponDiscount;

    // Fetch wallet (uses wallets table from wallet migration)
    let { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', session.userId)
      .single();

    if (!wallet) {
      // Auto-create wallet if trigger didn't fire
      const { data: w } = await supabaseAdmin
        .from('wallets')
        .insert([{ user_id: session.userId, balance: 0, bonus_balance: 0 }])
        .select()
        .single();
      wallet = w;
    }

    if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 500 });

    // Apply points if requested
    if (usePoints && (wallet.points || 0) > 0) {
      const maxPointsValue = amountAfterCoupon * 0.5;
      const pointsValue = Math.min(wallet.points / 100, maxPointsValue);
      pointsUsed = Math.floor(pointsValue * 100);
      pointsDiscount = pointsUsed / 100;
      amountAfterCoupon -= pointsDiscount;
    }

    const finalAmount = Math.max(0, amountAfterCoupon);

    // Check wallet balance
    const balance = parseFloat(wallet.balance || 0);
    const bonusBalance = parseFloat(wallet.bonus_balance || 0);
    const availableBalance = balance + bonusBalance;
    if (availableBalance < finalAmount) {
      return NextResponse.json({
        error: 'Insufficient wallet balance',
        required: finalAmount.toFixed(2),
        available: availableBalance.toFixed(2),
      }, { status: 400 });
    }

    // Deduct from bonus first, then main balance
    let remaining = finalAmount;
    let newBonus = bonusBalance;
    let newBalance = balance;

    if (newBonus > 0 && remaining > 0) {
      const fromBonus = Math.min(newBonus, remaining);
      newBonus -= fromBonus;
      remaining -= fromBonus;
    }
    newBalance -= remaining;

    // Get commission rate
    let rate = 15;
    try {
      const { data: settings } = await supabaseAdmin.from('express_settings').select('value').eq('key', 'commission_rate').single();
      if (settings?.value) rate = parseFloat(settings.value);
    } catch {}

    const commission = parseFloat(bid.amount) * (rate / 100);
    const payout = parseFloat(bid.amount) - commission;

    // Update wallet balance
    await supabaseAdmin.from('wallets').update({
      balance: newBalance.toFixed(2),
      bonus_balance: newBonus.toFixed(2),
      updated_at: new Date().toISOString(),
    }).eq('user_id', session.userId);

    // Record payment in wallet_transactions
    try {
      await supabaseAdmin.from('wallet_transactions').insert([{
        wallet_id: wallet.id,
        user_id: session.userId,
        type: 'payment',
        amount: finalAmount,
        direction: 'debit',
        balance_before: availableBalance,
        balance_after: (newBalance + newBonus),
        description: `Payment for job ${job.job_number}`,
        reference_id: jobId,
        status: 'completed',
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      }]);
    } catch (e) {
      console.error('Wallet transaction record error:', e?.message);
    }

    // Accept bid + reject others + assign driver
    await supabaseAdmin.from('express_bids').update({ status: 'accepted' }).eq('id', bidId);
    await supabaseAdmin.from('express_bids').update({ status: 'rejected' }).eq('job_id', jobId).neq('id', bidId).eq('status', 'pending');

    // Update job: base columns (always exist)
    const { error: jobUpdateErr } = await supabaseAdmin.from('express_jobs').update({
      status: 'assigned',
      assigned_driver_id: bid.driver_id,
    }).eq('id', jobId);

    if (jobUpdateErr) console.error('Job assign error:', jobUpdateErr.message);

    // Update job: extended columns (requires migration)
    try {
      const { error: extErr } = await supabaseAdmin.from('express_jobs').update({
        assigned_bid_id: bid.id,
        final_amount: bid.amount,
        commission_rate: rate,
        commission_amount: commission.toFixed(2),
        driver_payout: payout.toFixed(2),
        coupon_id: couponId,
        coupon_discount: couponDiscount.toFixed(2),
        points_used: pointsUsed,
        points_discount: pointsDiscount.toFixed(2),
        wallet_paid: true,
      }).eq('id', jobId);
      if (extErr) console.error('Job extended update error (run add-all-missing-columns.sql):', extErr.message);
    } catch (e) {
      console.error('Job extended update exception:', e?.message);
    }

    // Create escrow transaction (CRITICAL — release route depends on this)
    const { data: escrowTxn, error: escrowErr } = await supabaseAdmin.from('express_transactions').insert([{
      job_id: jobId,
      client_id: session.userId,
      driver_id: bid.driver_id,
      total_amount: bid.amount,
      commission_amount: commission.toFixed(2),
      driver_payout: payout.toFixed(2),
      payment_status: 'held',
      held_at: new Date().toISOString(),
    }]).select().single();

    if (escrowErr) {
      console.error('CRITICAL: Escrow insert failed:', escrowErr.message, escrowErr.details, escrowErr.hint);
      // Refund wallet since escrow failed
      await supabaseAdmin.from('wallets').update({
        balance: balance.toFixed(2),
        bonus_balance: bonusBalance.toFixed(2),
        updated_at: new Date().toISOString(),
      }).eq('user_id', session.userId);
      return NextResponse.json({ error: 'Payment processing failed. Your wallet has been refunded.' }, { status: 500 });
    }

    // Increment promo code usage
    if (couponId) {
      try {
        const { data: promo } = await supabaseAdmin.from('promo_codes').select('usage_count').eq('id', couponId).single();
        if (promo) {
          await supabaseAdmin.from('promo_codes').update({ usage_count: (promo.usage_count || 0) + 1 }).eq('id', couponId);
        }
      } catch {}
    }

    // Notifications
    try {
      const [driverRes, clientRes] = await Promise.all([
        supabaseAdmin.from('express_users').select('contact_name, phone, vehicle_type, vehicle_plate, driver_rating').eq('id', bid.driver_id).single(),
        supabaseAdmin.from('express_users').select('contact_name, phone, company_name').eq('id', session.userId).single(),
      ]);
      const driver = driverRes.data;
      const client = clientRes.data;

      await notify(bid.driver_id, {
        type: 'job', category: 'bid_activity',
        title: `Job ${job.job_number} assigned to you!`,
        message: `Your bid of $${parseFloat(bid.amount).toFixed(2)} has been accepted.${client ? `\nClient: ${client.contact_name}${client.phone ? ` (${client.phone})` : ''}` : ''}`,
        referenceId: jobId,
      });

      await notify(session.userId, {
        type: 'job', category: 'job_updates',
        title: `Driver assigned for ${job.job_number}`,
        message: `${driver?.contact_name || 'A driver'} has been assigned ($${parseFloat(bid.amount).toFixed(2)}).${driver ? `\nDriver: ${driver.contact_name}${driver.vehicle_plate ? ` (${driver.vehicle_plate})` : ''}` : ''}`,
        referenceId: jobId,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      payment: {
        total: totalAmount.toFixed(2),
        couponDiscount: couponDiscount.toFixed(2),
        pointsDiscount: pointsDiscount.toFixed(2),
        finalPaid: finalAmount.toFixed(2),
        walletBalance: (newBalance + newBonus).toFixed(2),
      },
    });
  } catch (err) {
    console.error('Wallet pay error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

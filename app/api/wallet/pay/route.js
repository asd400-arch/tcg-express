import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';
import { notify } from '../../../../lib/notify';

// Pay for a job using wallet balance + optional points
export async function POST(request) {
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

  // Apply coupon if provided
  if (couponCode) {
    const { data: coupon } = await supabaseAdmin
      .from('express_coupons')
      .select('*')
      .eq('code', couponCode.toUpperCase())
      .eq('is_active', true)
      .single();

    if (coupon) {
      const now = new Date();
      const expired = coupon.expires_at && new Date(coupon.expires_at) < now;
      const maxedOut = coupon.max_uses && coupon.used_count >= coupon.max_uses;
      const belowMin = coupon.min_order && totalAmount < parseFloat(coupon.min_order);

      // Check if user already used this coupon
      const { count } = await supabaseAdmin
        .from('express_coupon_usages')
        .select('id', { count: 'exact' })
        .eq('coupon_id', coupon.id)
        .eq('user_id', session.userId);

      if (!expired && !maxedOut && !belowMin && count === 0) {
        if (coupon.type === 'percent') {
          couponDiscount = totalAmount * (parseFloat(coupon.value) / 100);
          if (coupon.max_discount) couponDiscount = Math.min(couponDiscount, parseFloat(coupon.max_discount));
        } else {
          couponDiscount = parseFloat(coupon.value);
        }
        couponDiscount = Math.min(couponDiscount, totalAmount);
        couponId = coupon.id;
      }
    }
  }

  let amountAfterCoupon = totalAmount - couponDiscount;

  // Apply points if requested
  let { data: wallet } = await supabaseAdmin
    .from('express_wallets')
    .select('*')
    .eq('user_id', session.userId)
    .single();

  if (!wallet) {
    const { data: w } = await supabaseAdmin
      .from('express_wallets')
      .insert([{ user_id: session.userId }])
      .select()
      .single();
    wallet = w;
  }

  if (usePoints && wallet.points > 0) {
    const maxPointsValue = amountAfterCoupon * 0.5; // Max 50% of remaining amount
    const pointsValue = Math.min(wallet.points / 100, maxPointsValue);
    pointsUsed = Math.floor(pointsValue * 100);
    pointsDiscount = pointsUsed / 100;
    amountAfterCoupon -= pointsDiscount;
  }

  const finalAmount = Math.max(0, amountAfterCoupon);

  // Check wallet balance (balance + bonus)
  const availableBalance = parseFloat(wallet.balance) + parseFloat(wallet.bonus_balance);
  if (availableBalance < finalAmount) {
    return NextResponse.json({
      error: 'Insufficient wallet balance',
      required: finalAmount.toFixed(2),
      available: availableBalance.toFixed(2),
    }, { status: 400 });
  }

  // Deduct from bonus first, then main balance
  let remaining = finalAmount;
  let newBonus = parseFloat(wallet.bonus_balance);
  let newBalance = parseFloat(wallet.balance);

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

  // Update wallet
  const newPoints = wallet.points - pointsUsed;
  await supabaseAdmin.from('express_wallets').update({
    balance: newBalance.toFixed(2),
    bonus_balance: newBonus.toFixed(2),
    points: newPoints,
    updated_at: new Date().toISOString(),
  }).eq('user_id', session.userId);

  // Record payment transaction
  await supabaseAdmin.from('express_wallet_transactions').insert([{
    user_id: session.userId,
    type: 'payment',
    amount: (-finalAmount).toFixed(2),
    balance_after: (newBalance + newBonus).toFixed(2),
    description: `Payment for job ${job.job_number}`,
    reference_id: jobId,
  }]);

  if (pointsUsed > 0) {
    await supabaseAdmin.from('express_wallet_transactions').insert([{
      user_id: session.userId,
      type: 'points_payment',
      amount: (-pointsDiscount).toFixed(2),
      points_amount: -pointsUsed,
      points_after: newPoints,
      description: `Points redeemed for job ${job.job_number}`,
      reference_id: jobId,
    }]);
  }

  // Accept bid + reject others + assign driver
  await supabaseAdmin.from('express_bids').update({ status: 'accepted' }).eq('id', bidId);
  await supabaseAdmin.from('express_bids').update({ status: 'rejected' }).eq('job_id', jobId).neq('id', bidId).eq('status', 'pending');

  await supabaseAdmin.from('express_jobs').update({
    status: 'assigned',
    assigned_driver_id: bid.driver_id,
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

  // Create escrow transaction
  await supabaseAdmin.from('express_transactions').insert([{
    job_id: jobId,
    client_id: session.userId,
    driver_id: bid.driver_id,
    total_amount: bid.amount,
    commission_amount: commission.toFixed(2),
    driver_payout: payout.toFixed(2),
    payment_status: 'held',
    held_at: new Date().toISOString(),
  }]);

  // Record coupon usage
  if (couponId) {
    await supabaseAdmin.from('express_coupon_usages').insert([{
      coupon_id: couponId,
      user_id: session.userId,
      job_id: jobId,
      discount_amount: couponDiscount.toFixed(2),
    }]);
    await supabaseAdmin.from('express_coupons').update({
      used_count: supabaseAdmin.rpc ? undefined : undefined,
    }).eq('id', couponId);
    // Increment used_count
    await supabaseAdmin.rpc('increment_coupon_count', { coupon_uuid: couponId }).catch(() => {
      // Manual fallback
      supabaseAdmin.from('express_coupons').select('used_count').eq('id', couponId).single().then(({ data }) => {
        if (data) supabaseAdmin.from('express_coupons').update({ used_count: (data.used_count || 0) + 1 }).eq('id', couponId);
      });
    });
  }

  // Send notifications to driver and client
  try {
    const [driverRes, clientRes] = await Promise.all([
      supabaseAdmin.from('express_users').select('contact_name, phone, vehicle_type, vehicle_plate, driver_rating').eq('id', bid.driver_id).single(),
      supabaseAdmin.from('express_users').select('contact_name, phone, company_name').eq('id', session.userId).single(),
    ]);
    const driver = driverRes.data;
    const client = clientRes.data;

    // Notify driver with client info
    const clientInfo = client ? `\nClient: ${client.contact_name}${client.phone ? ` (${client.phone})` : ''}` : '';
    await notify(bid.driver_id, {
      type: 'job',
      category: 'bid_activity',
      title: `Job ${job.job_number} assigned to you!`,
      message: `Your bid of $${parseFloat(bid.amount).toFixed(2)} has been accepted.${clientInfo}`,
      referenceId: jobId,
    });

    // Notify client with driver info
    const driverInfo = driver ? `\nDriver: ${driver.contact_name}${driver.phone ? ` (${driver.phone})` : ''}${driver.vehicle_plate ? `\nVehicle: ${driver.vehicle_plate}` : ''}` : '';
    await notify(session.userId, {
      type: 'job',
      category: 'job_updates',
      title: `Driver assigned for ${job.job_number}`,
      message: `${driver?.contact_name || 'A driver'} has been assigned ($${parseFloat(bid.amount).toFixed(2)}).${driverInfo}`,
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
}

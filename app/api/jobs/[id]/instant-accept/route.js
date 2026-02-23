import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { getSession } from '../../../../../lib/auth';
import { notify } from '../../../../../lib/notify';

// POST: Driver instantly accepts job at customer's max budget
// Creates bid + processes wallet payment + assigns driver in one step
export async function POST(request, { params }) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'driver') return NextResponse.json({ error: 'Only drivers can accept jobs' }, { status: 403 });

    const { id: jobId } = await params;

    // Fetch job
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('express_jobs')
      .select('id, client_id, status, job_number, budget_max, budget_min')
      .eq('id', jobId)
      .single();

    if (jobErr || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (!['open', 'bidding'].includes(job.status)) {
      return NextResponse.json({ error: 'Job is no longer accepting bids' }, { status: 400 });
    }

    const bidAmount = parseFloat(job.budget_max) || parseFloat(job.budget_min);
    if (!bidAmount || bidAmount <= 0) {
      return NextResponse.json({ error: 'Job has no valid budget set' }, { status: 400 });
    }

    // Check driver doesn't already have a bid
    const { data: existingBid } = await supabaseAdmin
      .from('express_bids')
      .select('id')
      .eq('job_id', jobId)
      .eq('driver_id', session.userId)
      .eq('status', 'pending')
      .single();

    if (existingBid) {
      return NextResponse.json({ error: 'You already have a pending bid on this job' }, { status: 409 });
    }

    // Create bid at max_budget
    const { data: bid, error: bidErr } = await supabaseAdmin
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

    if (bidErr) return NextResponse.json({ error: bidErr.message }, { status: 500 });

    // Get client's wallet
    let { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', job.client_id)
      .single();

    if (!wallet) {
      const { data: w } = await supabaseAdmin
        .from('wallets')
        .insert([{ user_id: job.client_id, balance: 0, bonus_balance: 0 }])
        .select()
        .single();
      wallet = w;
    }

    if (!wallet) {
      // Revert bid
      await supabaseAdmin.from('express_bids').update({ status: 'rejected' }).eq('id', bid.id);
      return NextResponse.json({ error: 'Client wallet not found' }, { status: 500 });
    }

    const balance = parseFloat(wallet.balance || 0);
    const bonusBalance = parseFloat(wallet.bonus_balance || 0);
    const availableBalance = balance + bonusBalance;

    if (availableBalance < bidAmount) {
      // Revert bid
      await supabaseAdmin.from('express_bids').update({ status: 'rejected' }).eq('id', bid.id);
      return NextResponse.json({ error: 'Client has insufficient wallet balance for instant accept' }, { status: 400 });
    }

    // Deduct from bonus first, then main balance
    let remaining = bidAmount;
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

    const commission = bidAmount * (rate / 100);
    const payout = bidAmount - commission;

    // Update wallet balance
    const { error: walletUpdateErr } = await supabaseAdmin.from('wallets').update({
      balance: newBalance.toFixed(2),
      bonus_balance: newBonus.toFixed(2),
      updated_at: new Date().toISOString(),
    }).eq('user_id', job.client_id);

    if (walletUpdateErr) {
      await supabaseAdmin.from('express_bids').update({ status: 'rejected' }).eq('id', bid.id);
      return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 });
    }

    // Record wallet transaction
    try {
      await supabaseAdmin.from('wallet_transactions').insert([{
        wallet_id: wallet.id,
        user_id: job.client_id,
        type: 'payment',
        amount: bidAmount,
        direction: 'debit',
        balance_before: availableBalance,
        balance_after: (newBalance + newBonus),
        description: `Instant accept payment for job ${job.job_number}`,
        reference_id: jobId,
        status: 'completed',
        completed_at: new Date().toISOString(),
      }]);
    } catch (e) {
      console.error('Wallet transaction record error:', e?.message);
    }

    // Accept bid + reject others
    await supabaseAdmin.from('express_bids').update({ status: 'accepted' }).eq('id', bid.id);
    await supabaseAdmin.from('express_bids').update({ status: 'rejected' }).eq('job_id', jobId).neq('id', bid.id).eq('status', 'pending');

    // Update job: assign driver
    await supabaseAdmin.from('express_jobs').update({
      status: 'assigned',
      assigned_driver_id: session.userId,
    }).eq('id', jobId);

    // Update job: extended columns
    try {
      await supabaseAdmin.from('express_jobs').update({
        assigned_bid_id: bid.id,
        final_amount: bidAmount,
        commission_rate: rate,
        commission_amount: commission.toFixed(2),
        driver_payout: payout.toFixed(2),
        wallet_paid: true,
      }).eq('id', jobId);
    } catch {}

    // Create escrow transaction
    const { error: escrowErr } = await supabaseAdmin.from('express_transactions').insert([{
      job_id: jobId,
      client_id: job.client_id,
      driver_id: session.userId,
      total_amount: bidAmount,
      commission_amount: commission.toFixed(2),
      driver_payout: payout.toFixed(2),
      payment_status: 'held',
      held_at: new Date().toISOString(),
    }]).select().single();

    if (escrowErr) {
      console.error('Escrow insert failed on instant-accept:', escrowErr.message);
      // Refund wallet
      await supabaseAdmin.from('wallets').update({
        balance: balance.toFixed(2),
        bonus_balance: bonusBalance.toFixed(2),
        updated_at: new Date().toISOString(),
      }).eq('user_id', job.client_id);
      return NextResponse.json({ error: 'Payment processing failed. Client wallet refunded.' }, { status: 500 });
    }

    // Notify client
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
      });
    } catch {}

    return NextResponse.json({
      success: true,
      bid: { id: bid.id, amount: bidAmount },
      payout: payout.toFixed(2),
    });
  } catch (err) {
    console.error('POST /api/jobs/[id]/instant-accept error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

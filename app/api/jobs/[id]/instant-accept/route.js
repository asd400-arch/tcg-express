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

    // Check for existing bid — update it instead of creating a duplicate
    let bid;
    let wasExistingBid = false;
    let originalBidAmount = null;
    let originalBidMessage = null;
    const { data: existingBid } = await supabaseAdmin
      .from('express_bids')
      .select('id, amount, status, message')
      .eq('job_id', jobId)
      .eq('driver_id', session.userId)
      .in('status', ['pending'])
      .single();

    if (existingBid) {
      wasExistingBid = true;
      originalBidAmount = existingBid.amount;
      originalBidMessage = existingBid.message;
      // Update existing bid to budget amount
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('express_bids')
        .update({ amount: bidAmount, message: 'Instant accept at posted budget' })
        .eq('id', existingBid.id)
        .select()
        .single();
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
      bid = updated;
    } else {
      // Create new bid at max_budget
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
        return NextResponse.json({ error: bidErr.message }, { status: 500 });
      }
      bid = newBid;
    }

    // Helper: revert bid on failure — restore original if existing, delete if new
    const revertBid = async () => {
      if (wasExistingBid) {
        await supabaseAdmin.from('express_bids')
          .update({ amount: originalBidAmount, message: originalBidMessage })
          .eq('id', bid.id);
      } else {
        await supabaseAdmin.from('express_bids').delete().eq('id', bid.id);
      }
    };

    // Get client's wallet
    let { data: wallet, error: walletFetchErr } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', job.client_id)
      .single();

    if (walletFetchErr && walletFetchErr.code !== 'PGRST116') {
      console.error('Wallet fetch error:', walletFetchErr.message, '| code:', walletFetchErr.code);
    }

    if (!wallet) {
      const { data: w, error: walletCreateErr } = await supabaseAdmin
        .from('wallets')
        .insert([{ user_id: job.client_id }])
        .select()
        .single();
      if (walletCreateErr) console.error('Wallet create error:', walletCreateErr.message, '| code:', walletCreateErr.code);
      wallet = w;
    }

    if (!wallet) {
      await revertBid();
      return NextResponse.json({ error: 'Client wallet not found' }, { status: 500 });
    }

    const balance = parseFloat(wallet.balance || 0);

    if (balance < bidAmount) {
      await revertBid();
      return NextResponse.json({ error: 'Client has insufficient wallet balance for instant accept' }, { status: 400 });
    }

    // Get commission rate
    let rate = 15;
    try {
      const { data: settings } = await supabaseAdmin.from('express_settings').select('value').eq('key', 'commission_rate').single();
      if (settings?.value) rate = parseFloat(settings.value);
    } catch {}

    const commission = bidAmount * (rate / 100);
    const payout = bidAmount - commission;

    // Debit wallet via wallet_debit RPC (atomic: locks row, checks balance, deducts, creates transaction)
    const { error: debitErr } = await supabaseAdmin.rpc('wallet_debit', {
      p_wallet_id: wallet.id,
      p_user_id: job.client_id,
      p_amount: bidAmount,
      p_type: 'payment',
      p_reference_type: 'job',
      p_reference_id: jobId,
      p_description: `Instant accept payment for job ${job.job_number}`,
      p_metadata: { bid_id: bid.id, driver_id: session.userId },
    });

    if (debitErr) {
      console.error('WALLET DEBIT RPC FAILED:', debitErr.message, '| code:', debitErr.code, '| details:', debitErr.details, '| hint:', debitErr.hint, '| wallet_id:', wallet.id, '| amount:', bidAmount);
      await revertBid();
      return NextResponse.json({ error: `Failed to process payment: ${debitErr.message}` }, { status: 500 });
    }

    // Accept bid + close others (outbid, not rejected — customer didn't reject them)
    await supabaseAdmin.from('express_bids').update({ status: 'accepted' }).eq('id', bid.id);
    await supabaseAdmin.from('express_bids').update({ status: 'outbid' }).eq('job_id', jobId).neq('id', bid.id).eq('status', 'pending');

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
      console.error('CRITICAL: Escrow insert failed on instant-accept:', escrowErr.message, '| details:', escrowErr.details, '| hint:', escrowErr.hint);
      // Refund wallet via wallet_credit RPC
      const { error: refundErr } = await supabaseAdmin.rpc('wallet_credit', {
        p_wallet_id: wallet.id,
        p_user_id: job.client_id,
        p_amount: bidAmount,
        p_type: 'refund',
        p_reference_type: 'job',
        p_reference_id: jobId,
        p_description: `Refund for failed escrow on job ${job.job_number}`,
      });
      if (refundErr) console.error('CRITICAL: Refund also failed:', refundErr.message);
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

import { supabaseAdmin } from '../../../../lib/supabase-server';
import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { notify } from '../../../../lib/notify';

export async function POST(req) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = await req.json();
    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    // Verify user is the job's client
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('express_jobs')
      .select('id, client_id, job_number')
      .eq('id', jobId)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    if (job.client_id !== session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Find the held transaction for this job
    const { data: txn, error: txnErr } = await supabaseAdmin
      .from('express_transactions')
      .select('*')
      .eq('job_id', jobId)
      .eq('payment_status', 'held')
      .single();

    if (txnErr || !txn) {
      return NextResponse.json({ error: 'No held transaction found' }, { status: 404 });
    }

    // ============================================================
    // Credit driver wallet BEFORE marking transaction as paid
    // This ensures atomicity: if wallet credit fails, payment stays held
    // ============================================================
    const driverId = txn.driver_id;
    const driverPayout = parseFloat(txn.driver_payout);

    if (!driverId || driverPayout <= 0) {
      return NextResponse.json({ error: 'Invalid driver or payout amount' }, { status: 400 });
    }

    // Get or create driver's wallet (new wallets table)
    let { data: driverWallet } = await supabaseAdmin
      .from('wallets')
      .select('id')
      .eq('user_id', driverId)
      .single();

    if (!driverWallet) {
      const { data: newWallet, error: walletCreateErr } = await supabaseAdmin
        .from('wallets')
        .insert({ user_id: driverId })
        .select('id')
        .single();

      if (walletCreateErr || !newWallet) {
        return NextResponse.json({ error: 'Failed to create driver wallet' }, { status: 500 });
      }
      driverWallet = newWallet;
    }

    // Credit driver wallet via RPC (SECURITY DEFINER, atomic with row lock)
    const { data: driverTx, error: creditErr } = await supabaseAdmin.rpc('wallet_credit', {
      p_wallet_id: driverWallet.id,
      p_user_id: driverId,
      p_amount: driverPayout,
      p_type: 'earning',
      p_reference_type: 'job_payment',
      p_reference_id: jobId,
      p_payment_method: null,
      p_payment_provider_ref: null,
      p_description: `Delivery earning for job ${job.job_number || jobId}`,
      p_metadata: { job_id: jobId, total_amount: txn.total_amount, commission: txn.commission_amount },
    });

    if (creditErr) {
      console.error('Driver wallet credit failed:', creditErr.message);
      return NextResponse.json({ error: 'Failed to credit driver earnings' }, { status: 500 });
    }

    // ============================================================
    // Release: mark transaction as paid (only after driver is credited)
    // ============================================================
    const now = new Date().toISOString();
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('express_transactions')
      .update({ payment_status: 'paid', released_at: now, paid_at: now })
      .eq('id', txn.id)
      .select()
      .single();

    if (updateErr) {
      console.error('Transaction release failed after driver credit:', updateErr.message);
      return NextResponse.json({ error: 'Failed to release payment' }, { status: 500 });
    }

    // Update payments table with driver wallet transaction ID (if payment record exists)
    if (driverTx) {
      const driverTxId = Array.isArray(driverTx) ? driverTx[0]?.id : driverTx.id;
      if (driverTxId) {
        await supabaseAdmin
          .from('payments')
          .update({ driver_wallet_tx_id: driverTxId, settled_at: now })
          .eq('job_id', jobId)
          .in('payment_status', ['pending', 'paid']);
      }
    }

    // ============================================================
    // Award client loyalty points: 5% of total amount (100 points = $1)
    // ============================================================
    try {
      const pointsEarned = Math.floor(parseFloat(txn.total_amount) * 5); // 5% * 100
      if (pointsEarned > 0) {
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

        if (wallet) {
          const newPoints = (wallet.points || 0) + pointsEarned;
          await supabaseAdmin.from('express_wallets')
            .update({ points: newPoints, updated_at: new Date().toISOString() })
            .eq('user_id', session.userId);

          await supabaseAdmin.from('express_wallet_transactions').insert([{
            user_id: session.userId,
            type: 'points_earn',
            amount: '0',
            points_amount: pointsEarned,
            points_after: newPoints,
            description: `Points earned for completed delivery`,
            reference_id: jobId,
          }]);
        }
      }
    } catch (pointsErr) {
      console.error('Loyalty points award failed (non-critical):', pointsErr);
    }

    // ============================================================
    // Notify driver that earnings have been credited
    // ============================================================
    try {
      await notify(driverId, {
        type: 'wallet',
        category: 'earnings',
        title: 'Earnings credited!',
        message: `$${driverPayout.toFixed(2)} has been added to your wallet for job ${job.job_number || ''}`.trim(),
        referenceId: jobId,
        url: '/driver/wallet',
      });
    } catch {}

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('Transaction release error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

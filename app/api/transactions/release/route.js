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

    if (!driverId || !driverPayout || isNaN(driverPayout) || driverPayout <= 0) {
      console.error('Invalid driver/payout:', { driverId, driverPayout, raw: txn.driver_payout });
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
        try {
          await supabaseAdmin
            .from('payments')
            .update({ driver_wallet_tx_id: driverTxId, settled_at: now })
            .eq('job_id', jobId)
            .in('payment_status', ['pending', 'paid']);
        } catch {}
      }
    }

    // ============================================================
    // Award client green points (if applicable)
    // Note: loyalty points via wallets.points column was removed;
    // green points use green_points_ledger + express_users.green_points_balance
    // ============================================================
    try {
      const pointsEarned = Math.floor(parseFloat(txn.total_amount) * 5);
      if (pointsEarned > 0) {
        // Update user's green_points_balance
        const { data: usr } = await supabaseAdmin
          .from('express_users')
          .select('green_points_balance')
          .eq('id', session.userId)
          .single();

        if (usr) {
          const newBalance = (usr.green_points_balance || 0) + pointsEarned;
          await supabaseAdmin.from('express_users')
            .update({ green_points_balance: newBalance })
            .eq('id', session.userId);

          await supabaseAdmin.from('green_points_ledger').insert([{
            user_id: session.userId,
            user_type: 'client',
            job_id: jobId,
            points_earned: pointsEarned,
            points_type: 'loyalty',
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

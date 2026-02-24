import { supabaseAdmin } from '../../../../lib/supabase-server';
import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { notify } from '../../../../lib/notify';

export async function POST(req) {
  try {
    const session = getSession(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 403 });
    }

    const { disputeId, resolution, adminNotes } = await req.json();
    if (!disputeId || !resolution) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['refund_client', 'release_driver'].includes(resolution)) {
      return NextResponse.json({ error: 'Invalid resolution. Must be refund_client or release_driver' }, { status: 400 });
    }

    // Fetch dispute
    const { data: dispute, error: disputeErr } = await supabaseAdmin
      .from('express_disputes')
      .select('*, job:job_id(id, client_id, assigned_driver_id, job_number, final_amount, driver_payout)')
      .eq('id', disputeId)
      .single();

    if (disputeErr || !dispute) {
      console.error('Dispute fetch error:', disputeErr?.message);
      return NextResponse.json({ error: `Dispute not found: ${disputeErr?.message || 'no data'}` }, { status: 404 });
    }

    if (dispute.status === 'resolved') {
      return NextResponse.json({ error: 'Dispute already resolved' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const job = dispute.job;

    // Update dispute
    const { error: updateErr } = await supabaseAdmin
      .from('express_disputes')
      .update({
        status: 'resolved',
        resolution,
        admin_notes: adminNotes || null,
        resolved_by: session.userId,
        resolved_at: now,
        updated_at: now,
      })
      .eq('id', disputeId);

    if (updateErr) {
      console.error('Dispute update error:', updateErr.message);
      return NextResponse.json({ error: `Failed to update dispute: ${updateErr.message}` }, { status: 500 });
    }

    // Find the held transaction
    const { data: txn } = await supabaseAdmin
      .from('express_transactions')
      .select('*')
      .eq('job_id', job.id)
      .eq('payment_status', 'held')
      .maybeSingle();

    if (resolution === 'refund_client') {
      // Refund escrow
      if (txn) {
        const { error: txnErr } = await supabaseAdmin
          .from('express_transactions')
          .update({ payment_status: 'refunded', refunded_at: now })
          .eq('id', txn.id);
        if (txnErr) console.error('Transaction refund update error:', txnErr.message);
      }

      const { error: jobErr } = await supabaseAdmin
        .from('express_jobs')
        .update({ status: 'cancelled', cancelled_at: now, cancelled_by: 'admin' })
        .eq('id', job.id);
      if (jobErr) console.error('Job cancel update error:', jobErr.message);

      // Credit client wallet if txn exists
      if (txn) {
        try {
          const { data: wallet } = await supabaseAdmin
            .from('wallets')
            .select('id')
            .eq('user_id', job.client_id)
            .single();
          if (wallet) {
            const { error: creditErr } = await supabaseAdmin.rpc('wallet_credit', {
              p_wallet_id: wallet.id,
              p_user_id: job.client_id,
              p_amount: parseFloat(txn.total_amount),
              p_type: 'refund',
              p_reference_type: 'dispute',
              p_reference_id: disputeId,
              p_description: `Dispute refund for job ${job.job_number}`,
            });
            if (creditErr) console.error('Wallet refund credit error:', creditErr.message);
          }
        } catch (e) {
          console.error('Wallet refund exception:', e?.message);
        }
      }

      const refundAmount = txn ? parseFloat(txn.total_amount).toFixed(2) : job.final_amount;

      // Notifications (wrapped to not break resolution)
      try {
        if (job.client_id) {
          await notify(job.client_id, {
            type: 'dispute', category: 'job_updates',
            title: `Dispute resolved — ${job.job_number}`,
            message: `Resolved in your favor. Escrow of $${refundAmount} has been refunded.`,
            url: `/client/jobs/${job.id}`,
          });
        }
        if (job.assigned_driver_id) {
          await notify(job.assigned_driver_id, {
            type: 'dispute', category: 'job_updates',
            title: `Dispute resolved — ${job.job_number}`,
            message: `Resolved in favor of the client. Escrow has been refunded.`,
            url: '/driver/my-jobs',
          });
        }
      } catch (notifyErr) {
        console.error('Dispute resolve notification error:', notifyErr?.message);
      }
    } else {
      // release_driver — release escrow to driver
      if (txn) {
        const { error: txnErr } = await supabaseAdmin
          .from('express_transactions')
          .update({ payment_status: 'paid', released_at: now, paid_at: now })
          .eq('id', txn.id);
        if (txnErr) console.error('Transaction release update error:', txnErr.message);
      }

      const { error: jobErr } = await supabaseAdmin
        .from('express_jobs')
        .update({ status: 'confirmed', confirmed_at: now })
        .eq('id', job.id);
      if (jobErr) console.error('Job confirm update error:', jobErr.message);

      // Credit driver wallet if txn exists
      if (txn) {
        try {
          const { data: wallet } = await supabaseAdmin
            .from('wallets')
            .select('id')
            .eq('user_id', job.assigned_driver_id)
            .single();
          if (wallet) {
            const driverPayout = parseFloat(txn.driver_payout || job.driver_payout || txn.total_amount);
            const { error: creditErr } = await supabaseAdmin.rpc('wallet_credit', {
              p_wallet_id: wallet.id,
              p_user_id: job.assigned_driver_id,
              p_amount: driverPayout,
              p_type: 'earning',
              p_reference_type: 'dispute',
              p_reference_id: disputeId,
              p_description: `Dispute payout for job ${job.job_number}`,
            });
            if (creditErr) console.error('Wallet driver credit error:', creditErr.message);
          }
        } catch (e) {
          console.error('Wallet driver payout exception:', e?.message);
        }
      }

      const payoutAmount = job.driver_payout || job.final_amount;

      // Notifications (wrapped to not break resolution)
      try {
        if (job.assigned_driver_id) {
          await notify(job.assigned_driver_id, {
            type: 'dispute', category: 'job_updates',
            title: `Dispute resolved — ${job.job_number}`,
            message: `Resolved in your favor. Payment of $${payoutAmount} has been released.`,
            url: '/driver/my-jobs',
          });
        }
        if (job.client_id) {
          await notify(job.client_id, {
            type: 'dispute', category: 'job_updates',
            title: `Dispute resolved — ${job.job_number}`,
            message: `Resolved in favor of the driver. Payment has been released.`,
            url: `/client/jobs/${job.id}`,
          });
        }
      } catch (notifyErr) {
        console.error('Dispute resolve notification error:', notifyErr?.message);
      }
    }

    return NextResponse.json({ data: { disputeId, resolution } });
  } catch (err) {
    console.error('POST /api/disputes/resolve error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

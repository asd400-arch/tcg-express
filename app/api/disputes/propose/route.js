import { supabaseAdmin } from '../../../../lib/supabase-server';
import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { notify } from '../../../../lib/notify';

// POST: Propose or accept a dispute settlement between customer and driver
export async function POST(req) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['client', 'driver'].includes(session.role)) {
      return NextResponse.json({ error: 'Only clients and drivers can propose settlements' }, { status: 403 });
    }

    const body = await req.json();
    const { disputeId, action } = body;
    // action: 'propose' | 'accept'

    if (!disputeId || !action) {
      return NextResponse.json({ error: 'Missing disputeId or action' }, { status: 400 });
    }

    // Fetch dispute with job details
    const { data: dispute, error: dErr } = await supabaseAdmin
      .from('express_disputes')
      .select('*, job:job_id(id, client_id, assigned_driver_id, job_number, final_amount, driver_payout, commission_amount, commission_rate)')
      .eq('id', disputeId)
      .single();

    if (dErr || !dispute) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    if (dispute.status === 'resolved') return NextResponse.json({ error: 'Dispute already resolved' }, { status: 400 });

    const job = dispute.job;
    // Verify user is part of this job
    if (session.userId !== job.client_id && session.userId !== job.assigned_driver_id) {
      return NextResponse.json({ error: 'Not authorized for this dispute' }, { status: 403 });
    }

    const otherPartyId = session.userId === job.client_id ? job.assigned_driver_id : job.client_id;
    const userRole = session.userId === job.client_id ? 'client' : 'driver';

    if (action === 'propose') {
      const { resolution_type, proposed_amount } = body;
      // resolution_type: 'full_refund' | 'full_release' | 'adjusted_amount'
      if (!['full_refund', 'full_release', 'adjusted_amount'].includes(resolution_type)) {
        return NextResponse.json({ error: 'Invalid resolution type' }, { status: 400 });
      }

      const totalAmount = parseFloat(job.final_amount) || 0;
      let amount = null;

      if (resolution_type === 'full_refund') {
        amount = totalAmount;
      } else if (resolution_type === 'full_release') {
        amount = 0; // 0 refund to customer, full to driver
      } else {
        // adjusted_amount — amount is what driver gets
        amount = parseFloat(proposed_amount);
        if (isNaN(amount) || amount < 0 || amount > totalAmount) {
          return NextResponse.json({ error: `Adjusted amount must be between $0 and $${totalAmount.toFixed(2)}` }, { status: 400 });
        }
      }

      const { error: updateErr } = await supabaseAdmin
        .from('express_disputes')
        .update({
          proposed_resolution: resolution_type,
          proposed_amount: amount,
          proposed_by: session.userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', disputeId);

      if (updateErr) return NextResponse.json({ error: 'Failed to save proposal' }, { status: 500 });

      // Notify other party
      const resLabel = resolution_type === 'full_refund' ? 'full refund to customer'
        : resolution_type === 'full_release' ? 'full payment to driver'
        : `adjusted amount of $${amount.toFixed(2)} to driver`;
      try {
        await notify(otherPartyId, {
          type: 'dispute', category: 'job_updates',
          title: `Settlement proposed — ${job.job_number}`,
          message: `${userRole === 'client' ? 'Customer' : 'Driver'} proposed: ${resLabel}. Review and accept or counter.`,
          url: userRole === 'client' ? '/driver/my-jobs' : `/client/jobs/${job.id}`,
        });
      } catch {}

      return NextResponse.json({ data: { status: 'proposed', resolution_type, amount } });
    }

    if (action === 'accept') {
      // Verify there IS a proposal, and it was NOT by the current user
      if (!dispute.proposed_by || !dispute.proposed_resolution) {
        return NextResponse.json({ error: 'No proposal to accept' }, { status: 400 });
      }
      if (dispute.proposed_by === session.userId) {
        return NextResponse.json({ error: 'You cannot accept your own proposal' }, { status: 400 });
      }

      const now = new Date().toISOString();
      const totalAmount = parseFloat(job.final_amount) || 0;
      const resolution = dispute.proposed_resolution;
      const proposedAmt = parseFloat(dispute.proposed_amount) || 0;

      // Find held transaction
      const { data: txn } = await supabaseAdmin
        .from('express_transactions')
        .select('*')
        .eq('job_id', job.id)
        .eq('payment_status', 'held')
        .maybeSingle();

      let driverPayout = 0;
      let customerRefund = 0;
      let resolvedAmount = 0;

      if (resolution === 'full_refund') {
        customerRefund = txn ? parseFloat(txn.total_amount) : totalAmount;
        resolvedAmount = 0;
      } else if (resolution === 'full_release') {
        driverPayout = parseFloat(txn?.driver_payout || job.driver_payout || totalAmount);
        resolvedAmount = totalAmount;
      } else {
        // adjusted_amount — proposedAmt is what driver gets (before commission)
        const commissionRate = parseFloat(job.commission_rate) || 15;
        const commission = parseFloat((proposedAmt * commissionRate / 100).toFixed(2));
        driverPayout = parseFloat((proposedAmt - commission).toFixed(2));
        customerRefund = parseFloat((totalAmount - proposedAmt).toFixed(2));
        resolvedAmount = proposedAmt;
      }

      // Update dispute as resolved
      const { error: resolveErr } = await supabaseAdmin
        .from('express_disputes')
        .update({
          status: 'resolved',
          resolution_type: resolution,
          resolved_amount: resolvedAmount,
          resolved_by: session.userId,
          resolved_at: now,
          updated_at: now,
        })
        .eq('id', disputeId);

      if (resolveErr) return NextResponse.json({ error: 'Failed to resolve dispute' }, { status: 500 });

      // Update transaction
      if (txn) {
        if (resolution === 'full_refund') {
          await supabaseAdmin.from('express_transactions').update({ payment_status: 'refunded', refunded_at: now }).eq('id', txn.id);
        } else {
          await supabaseAdmin.from('express_transactions').update({ payment_status: 'paid', released_at: now, paid_at: now }).eq('id', txn.id);
        }
      }

      // Update job status
      if (resolution === 'full_refund') {
        await supabaseAdmin.from('express_jobs').update({ status: 'cancelled', cancelled_at: now, cancelled_by: 'dispute_settlement' }).eq('id', job.id);
      } else {
        await supabaseAdmin.from('express_jobs').update({ status: 'confirmed', confirmed_at: now }).eq('id', job.id);
      }

      // Wallet settlements
      if (customerRefund > 0) {
        try {
          const { data: wallet } = await supabaseAdmin.from('wallets').select('id').eq('user_id', job.client_id).single();
          if (wallet) {
            await supabaseAdmin.rpc('wallet_credit', {
              p_wallet_id: wallet.id,
              p_user_id: job.client_id,
              p_amount: customerRefund,
              p_type: 'refund',
              p_reference_type: 'dispute_settlement',
              p_reference_id: disputeId,
              p_description: `Dispute settlement refund for job ${job.job_number}`,
            });
          }
        } catch (e) {
          console.error('Dispute settlement client refund error:', e?.message);
        }
      }

      if (driverPayout > 0) {
        try {
          const { data: wallet } = await supabaseAdmin.from('wallets').select('id').eq('user_id', job.assigned_driver_id).single();
          if (wallet) {
            await supabaseAdmin.rpc('wallet_credit', {
              p_wallet_id: wallet.id,
              p_user_id: job.assigned_driver_id,
              p_amount: driverPayout,
              p_type: 'earning',
              p_reference_type: 'dispute_settlement',
              p_reference_id: disputeId,
              p_description: `Dispute settlement payout for job ${job.job_number}`,
            });
          }
        } catch (e) {
          console.error('Dispute settlement driver payout error:', e?.message);
        }
      }

      // Notify both parties
      const resLabel = resolution === 'full_refund' ? 'Full refund to customer'
        : resolution === 'full_release' ? 'Full payment to driver'
        : `Adjusted amount: $${resolvedAmount.toFixed(2)}`;
      try {
        await Promise.all([
          notify(job.client_id, {
            type: 'dispute', category: 'job_updates',
            title: `Dispute settled — ${job.job_number}`,
            message: `${resLabel}.${customerRefund > 0 ? ` $${customerRefund.toFixed(2)} refunded to your wallet.` : ''}`,
            url: `/client/jobs/${job.id}`,
          }),
          notify(job.assigned_driver_id, {
            type: 'dispute', category: 'job_updates',
            title: `Dispute settled — ${job.job_number}`,
            message: `${resLabel}.${driverPayout > 0 ? ` $${driverPayout.toFixed(2)} paid to your wallet.` : ''}`,
            url: '/driver/my-jobs',
          }),
        ]);
      } catch {}

      return NextResponse.json({
        data: {
          status: 'resolved',
          resolution_type: resolution,
          resolved_amount: resolvedAmount,
          driver_payout: driverPayout,
          customer_refund: customerRefund,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('POST /api/disputes/propose error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

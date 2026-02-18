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
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
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
      return NextResponse.json({ error: 'Failed to update dispute' }, { status: 500 });
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
        await supabaseAdmin
          .from('express_transactions')
          .update({ payment_status: 'refunded', refunded_at: now })
          .eq('id', txn.id);
      }

      await supabaseAdmin
        .from('express_jobs')
        .update({ status: 'cancelled', cancelled_at: now, cancelled_by: 'admin' })
        .eq('id', job.id);

      const refundAmount = txn ? parseFloat(txn.total_amount).toFixed(2) : job.final_amount;
      const emailData = { jobNumber: job.job_number, resolution: 'Refunded to client', adminNotes: adminNotes || 'No additional notes' };

      // Notify client
      if (job.client_id) {
        await notify(job.client_id, {
          type: 'dispute', category: 'job_updates',
          title: `Dispute resolved — ${job.job_number}`,
          message: `Resolved in your favor. Escrow of $${refundAmount} has been refunded.`,
          emailTemplate: 'dispute_resolved', emailData,
          url: `/client/jobs/${job.id}`,
        });
      }
      // Notify driver
      if (job.assigned_driver_id) {
        await notify(job.assigned_driver_id, {
          type: 'dispute', category: 'job_updates',
          title: `Dispute resolved — ${job.job_number}`,
          message: `Resolved in favor of the client. Escrow has been refunded.`,
          emailTemplate: 'dispute_resolved', emailData,
          url: '/driver/my-jobs',
        });
      }
    } else {
      // release_driver — release escrow to driver
      if (txn) {
        await supabaseAdmin
          .from('express_transactions')
          .update({ payment_status: 'paid', released_at: now, paid_at: now })
          .eq('id', txn.id);
      }

      await supabaseAdmin
        .from('express_jobs')
        .update({ status: 'confirmed', confirmed_at: now })
        .eq('id', job.id);

      const payoutAmount = job.driver_payout || job.final_amount;
      const emailData = { jobNumber: job.job_number, resolution: 'Released to driver', adminNotes: adminNotes || 'No additional notes' };

      // Notify driver
      if (job.assigned_driver_id) {
        await notify(job.assigned_driver_id, {
          type: 'dispute', category: 'job_updates',
          title: `Dispute resolved — ${job.job_number}`,
          message: `Resolved in your favor. Payment of $${payoutAmount} has been released.`,
          emailTemplate: 'dispute_resolved', emailData,
          url: '/driver/my-jobs',
        });
      }
      // Notify client
      if (job.client_id) {
        await notify(job.client_id, {
          type: 'dispute', category: 'job_updates',
          title: `Dispute resolved — ${job.job_number}`,
          message: `Resolved in favor of the driver. Payment has been released.`,
          emailTemplate: 'dispute_resolved', emailData,
          url: `/client/jobs/${job.id}`,
        });
      }
    }

    return NextResponse.json({ data: { disputeId, resolution } });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

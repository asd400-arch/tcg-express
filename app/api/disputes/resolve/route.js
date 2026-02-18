import { supabaseAdmin } from '../../../../lib/supabase-server';
import { createNotification } from '../../../../lib/notifications';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { disputeId, adminId, resolution, adminNotes } = await req.json();
    if (!disputeId || !adminId || !resolution) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['refund_client', 'release_driver'].includes(resolution)) {
      return NextResponse.json({ error: 'Invalid resolution. Must be refund_client or release_driver' }, { status: 400 });
    }

    // Verify admin
    const { data: admin } = await supabaseAdmin
      .from('express_users')
      .select('id, role, contact_name')
      .eq('id', adminId)
      .single();

    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 403 });
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
        resolved_by: adminId,
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
      // Refund escrow — same logic as Phase 10 refund
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

      // Notify client
      if (job.client_id) {
        await createNotification(
          job.client_id,
          'dispute',
          `Dispute resolved — ${job.job_number}`,
          `Resolved in your favor. Escrow of $${refundAmount} has been refunded.`
        );
      }
      // Notify driver
      if (job.assigned_driver_id) {
        await createNotification(
          job.assigned_driver_id,
          'dispute',
          `Dispute resolved — ${job.job_number}`,
          `Resolved in favor of the client. Escrow has been refunded.`
        );
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

      // Notify driver
      if (job.assigned_driver_id) {
        await createNotification(
          job.assigned_driver_id,
          'dispute',
          `Dispute resolved — ${job.job_number}`,
          `Resolved in your favor. Payment of $${payoutAmount} has been released.`
        );
      }
      // Notify client
      if (job.client_id) {
        await createNotification(
          job.client_id,
          'dispute',
          `Dispute resolved — ${job.job_number}`,
          `Resolved in favor of the driver. Payment has been released.`
        );
      }
    }

    // Send emails to both parties
    try {
      const emailPromises = [];
      const [clientRes, driverRes] = await Promise.all([
        job.client_id ? supabaseAdmin.from('express_users').select('email').eq('id', job.client_id).single() : null,
        job.assigned_driver_id ? supabaseAdmin.from('express_users').select('email').eq('id', job.assigned_driver_id).single() : null,
      ]);

      const emailData = {
        jobNumber: job.job_number,
        resolution: resolution === 'refund_client' ? 'Refunded to client' : 'Released to driver',
        adminNotes: adminNotes || 'No additional notes',
      };

      if (clientRes?.data?.email) {
        emailPromises.push(
          fetch(new URL('/api/notifications/email', req.url), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: clientRes.data.email, type: 'dispute_resolved', data: emailData }),
          })
        );
      }
      if (driverRes?.data?.email) {
        emailPromises.push(
          fetch(new URL('/api/notifications/email', req.url), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: driverRes.data.email, type: 'dispute_resolved', data: emailData }),
          })
        );
      }
      await Promise.allSettled(emailPromises);
    } catch (e) {
      // Email failures shouldn't block
    }

    return NextResponse.json({ data: { disputeId, resolution } });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

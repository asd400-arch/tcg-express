import { supabaseAdmin } from '../../../../lib/supabase-server';
import { createNotification } from '../../../../lib/notifications';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { userId, jobId, role } = await req.json();
    if (!userId || !jobId || !role) {
      return NextResponse.json({ error: 'Missing userId, jobId, or role' }, { status: 400 });
    }

    // Fetch job with client info
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('express_jobs')
      .select('id, client_id, assigned_driver_id, status, job_number, final_amount')
      .eq('id', jobId)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Authorization & status checks
    if (role === 'client') {
      if (job.client_id !== userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      if (!['assigned', 'pickup_confirmed'].includes(job.status)) {
        return NextResponse.json({ error: 'Client can only cancel assigned or pickup_confirmed jobs' }, { status: 400 });
      }
    } else if (role === 'admin') {
      const { data: adminUser } = await supabaseAdmin
        .from('express_users')
        .select('role')
        .eq('id', userId)
        .single();
      if (!adminUser || adminUser.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 403 });
      }
      if (['confirmed', 'completed', 'cancelled'].includes(job.status)) {
        return NextResponse.json({ error: 'Cannot cancel a job that is already confirmed, completed, or cancelled' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Find the held transaction for this job
    const { data: txn, error: txnErr } = await supabaseAdmin
      .from('express_transactions')
      .select('*')
      .eq('job_id', jobId)
      .eq('payment_status', 'held')
      .single();

    if (txnErr || !txn) {
      return NextResponse.json({ error: 'No held transaction found for this job' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Update transaction: refund
    const { error: txnUpdateErr } = await supabaseAdmin
      .from('express_transactions')
      .update({ payment_status: 'refunded', refunded_at: now })
      .eq('id', txn.id);

    if (txnUpdateErr) {
      return NextResponse.json({ error: 'Failed to refund transaction' }, { status: 500 });
    }

    // Update job: cancel
    const { error: jobUpdateErr } = await supabaseAdmin
      .from('express_jobs')
      .update({ status: 'cancelled', cancelled_at: now, cancelled_by: role })
      .eq('id', jobId);

    if (jobUpdateErr) {
      return NextResponse.json({ error: 'Failed to cancel job' }, { status: 500 });
    }

    // Send notifications
    const refundAmount = parseFloat(txn.total_amount).toFixed(2);
    const cancelledBy = role === 'client' ? 'the client' : 'an admin';

    if (role === 'client' && job.assigned_driver_id) {
      // Client cancel → notify driver
      await createNotification(
        job.assigned_driver_id,
        'job',
        `Job ${job.job_number} cancelled`,
        `Cancelled by ${cancelledBy}. Escrow of $${refundAmount} has been refunded.`
      );
    } else if (role === 'admin') {
      // Admin cancel → notify both client and driver
      if (job.client_id) {
        await createNotification(
          job.client_id,
          'job',
          `Job ${job.job_number} cancelled by admin`,
          `Escrow of $${refundAmount} has been refunded.`
        );
      }
      if (job.assigned_driver_id) {
        await createNotification(
          job.assigned_driver_id,
          'job',
          `Job ${job.job_number} cancelled by admin`,
          `Escrow of $${refundAmount} has been refunded.`
        );
      }
    }

    // Send email notifications
    try {
      // Get client and driver emails
      const emailPromises = [];
      if (job.assigned_driver_id) {
        const { data: driver } = await supabaseAdmin.from('express_users').select('email').eq('id', job.assigned_driver_id).single();
        if (driver?.email) {
          emailPromises.push(
            fetch(new URL('/api/notifications/email', req.url), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ to: driver.email, type: 'job_cancelled', data: { jobNumber: job.job_number, cancelledBy, refundAmount } }),
            })
          );
        }
      }
      if (role === 'admin' && job.client_id) {
        const { data: client } = await supabaseAdmin.from('express_users').select('email').eq('id', job.client_id).single();
        if (client?.email) {
          emailPromises.push(
            fetch(new URL('/api/notifications/email', req.url), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ to: client.email, type: 'job_cancelled', data: { jobNumber: job.job_number, cancelledBy, refundAmount } }),
            })
          );
        }
      }
      await Promise.allSettled(emailPromises);
    } catch (e) {
      // Email failures shouldn't block the refund response
    }

    return NextResponse.json({ data: { jobId, refundAmount, cancelledBy: role } });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

import { supabaseAdmin } from '../../../../lib/supabase-server';
import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { notify } from '../../../../lib/notify';
import { getStripe } from '../../../../lib/stripe';

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
    if (session.role === 'client') {
      if (job.client_id !== session.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      if (!['assigned', 'pickup_confirmed'].includes(job.status)) {
        return NextResponse.json({ error: 'Client can only cancel assigned or pickup_confirmed jobs' }, { status: 400 });
      }
    } else if (session.role === 'admin') {
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

    // Stripe refund (if real payment was made)
    let stripeRefundId = null;
    if (txn.stripe_payment_intent_id) {
      const stripe = getStripe();
      if (stripe) {
        try {
          const refund = await stripe.refunds.create({
            payment_intent: txn.stripe_payment_intent_id,
          });
          stripeRefundId = refund.id;
        } catch (stripeErr) {
          console.error('Stripe refund error:', stripeErr);
          return NextResponse.json({ error: 'Stripe refund failed' }, { status: 500 });
        }
      }
    }

    // Update transaction: refund
    const txnUpdate = { payment_status: 'refunded', refunded_at: now };
    if (stripeRefundId) txnUpdate.stripe_refund_id = stripeRefundId;
    const { error: txnUpdateErr } = await supabaseAdmin
      .from('express_transactions')
      .update(txnUpdate)
      .eq('id', txn.id);

    if (txnUpdateErr) {
      return NextResponse.json({ error: 'Failed to refund transaction' }, { status: 500 });
    }

    // Update job: cancel
    const { error: jobUpdateErr } = await supabaseAdmin
      .from('express_jobs')
      .update({ status: 'cancelled', cancelled_at: now, cancelled_by: session.role })
      .eq('id', jobId);

    if (jobUpdateErr) {
      return NextResponse.json({ error: 'Failed to cancel job' }, { status: 500 });
    }

    // Send notifications
    const refundAmount = parseFloat(txn.total_amount).toFixed(2);
    const cancelledBy = session.role === 'client' ? 'the client' : 'an admin';
    const emailData = { jobNumber: job.job_number, cancelledBy, refundAmount };

    if (session.role === 'client' && job.assigned_driver_id) {
      // Client cancel → notify driver
      await notify(job.assigned_driver_id, {
        type: 'job', category: 'job_updates',
        title: `Job ${job.job_number} cancelled`,
        message: `Cancelled by ${cancelledBy}. Escrow of $${refundAmount} has been refunded.`,
        emailTemplate: 'job_cancelled', emailData,
        url: '/driver/my-jobs',
      });
    } else if (session.role === 'admin') {
      // Admin cancel → notify both client and driver
      if (job.client_id) {
        await notify(job.client_id, {
          type: 'job', category: 'job_updates',
          title: `Job ${job.job_number} cancelled by admin`,
          message: `Escrow of $${refundAmount} has been refunded.`,
          emailTemplate: 'job_cancelled', emailData,
          url: `/client/jobs/${jobId}`,
        });
      }
      if (job.assigned_driver_id) {
        await notify(job.assigned_driver_id, {
          type: 'job', category: 'job_updates',
          title: `Job ${job.job_number} cancelled by admin`,
          message: `Escrow of $${refundAmount} has been refunded.`,
          emailTemplate: 'job_cancelled', emailData,
          url: '/driver/my-jobs',
        });
      }
    }

    return NextResponse.json({ data: { jobId, refundAmount, cancelledBy: session.role } });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

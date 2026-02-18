import { supabaseAdmin } from '../../../lib/supabase-server';
import { createNotification } from '../../../lib/notifications';
import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth';
import { notify } from '../../../lib/notify';

const VALID_REASONS = ['damaged_item', 'wrong_delivery', 'late_delivery', 'wrong_address', 'item_not_as_described', 'driver_no_show', 'other'];
const DISPUTABLE_STATUSES = ['assigned', 'pickup_confirmed', 'in_transit', 'delivered'];

export async function POST(req) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId, reason, description } = await req.json();
    if (!jobId || !reason || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!VALID_REASONS.includes(reason)) {
      return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
    }

    // Look up user role
    const { data: user, error: userErr } = await supabaseAdmin
      .from('express_users')
      .select('id, role, contact_name, email')
      .eq('id', session.userId)
      .single();

    if (userErr || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!['client', 'driver'].includes(user.role)) {
      return NextResponse.json({ error: 'Only clients and drivers can open disputes' }, { status: 403 });
    }

    // Fetch job
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('express_jobs')
      .select('id, client_id, assigned_driver_id, status, job_number')
      .eq('id', jobId)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Verify user is part of this job
    if (user.role === 'client' && job.client_id !== session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (user.role === 'driver' && job.assigned_driver_id !== session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Validate job has held escrow
    if (!DISPUTABLE_STATUSES.includes(job.status)) {
      return NextResponse.json({ error: 'Disputes can only be opened on jobs with held escrow (assigned, pickup_confirmed, in_transit, delivered)' }, { status: 400 });
    }

    // Check no existing open/under_review dispute
    const { data: existing } = await supabaseAdmin
      .from('express_disputes')
      .select('id')
      .eq('job_id', jobId)
      .in('status', ['open', 'under_review'])
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'An active dispute already exists for this job' }, { status: 400 });
    }

    // Insert dispute
    const { data: dispute, error: insertErr } = await supabaseAdmin
      .from('express_disputes')
      .insert([{
        job_id: jobId,
        opened_by: session.userId,
        opened_by_role: user.role,
        reason,
        description,
        status: 'open',
      }])
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: 'Failed to create dispute' }, { status: 500 });
    }

    // Update job status to disputed
    await supabaseAdmin
      .from('express_jobs')
      .update({ status: 'disputed' })
      .eq('id', jobId);

    // Notify the other party
    const reasonLabel = reason.replace(/_/g, ' ');
    const otherPartyId = user.role === 'client' ? job.assigned_driver_id : job.client_id;

    if (otherPartyId) {
      await notify(otherPartyId, {
        type: 'dispute',
        category: 'job_updates',
        title: `Dispute opened on ${job.job_number}`,
        message: `${user.contact_name} opened a dispute: ${reasonLabel}`,
        emailTemplate: 'job_disputed',
        emailData: { jobNumber: job.job_number, openerName: user.contact_name, openerRole: user.role, reason: reasonLabel, description },
        url: user.role === 'client' ? '/driver/my-jobs' : `/client/jobs/${jobId}`,
      });
    }

    // Notify all admins (in-app only, no email template for admin dispute alerts)
    const { data: admins } = await supabaseAdmin
      .from('express_users')
      .select('id')
      .eq('role', 'admin');

    if (admins) {
      for (const admin of admins) {
        await createNotification(
          admin.id,
          'dispute',
          `New dispute on ${job.job_number}`,
          `${user.contact_name} (${user.role}) opened a dispute: ${reasonLabel}`
        );
      }
    }

    return NextResponse.json({ data: dispute });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role === 'admin') {
      const { data, error } = await supabaseAdmin
        .from('express_disputes')
        .select('*, job:job_id(id, job_number, client_id, assigned_driver_id, status, final_amount), opener:opened_by(id, contact_name, email)')
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: 'Failed to fetch disputes' }, { status: 500 });
      }
      return NextResponse.json({ data });
    }

    // For clients/drivers — get disputes for jobs where user is client or driver
    const { data: userJobs } = await supabaseAdmin
      .from('express_jobs')
      .select('id')
      .or(`client_id.eq.${session.userId},assigned_driver_id.eq.${session.userId}`);

    const jobIds = (userJobs || []).map(j => j.id);
    if (jobIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const { data, error } = await supabaseAdmin
      .from('express_disputes')
      .select('*, job:job_id(id, job_number, status), opener:opened_by(id, contact_name)')
      .in('job_id', jobIds)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch disputes' }, { status: 500 });
    }
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

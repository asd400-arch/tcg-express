import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { getSession } from '../../../../../lib/auth';
import { notify } from '../../../../../lib/notify';

const VALID_TRANSITIONS = {
  assigned: ['pickup_confirmed', 'picked_up'],
  pickup_confirmed: ['in_transit'],
  picked_up: ['in_transit'],
  in_transit: ['delivered'],
  delivered: ['confirmed', 'completed'],
};

// Normalize mobile status names to DB status names
const STATUS_ALIASES = {
  picked_up: 'pickup_confirmed',
};

export async function POST(request, { params }) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  let { status } = body;
  const photoUrl = body.proof_photo_url || body.photo_url;

  if (!status) return NextResponse.json({ error: 'Status required' }, { status: 400 });

  const { data: job, error: jobErr } = await supabaseAdmin
    .from('express_jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (jobErr || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  // Verify permission
  if (session.role === 'driver' && job.assigned_driver_id !== session.userId) {
    return NextResponse.json({ error: 'Not your job' }, { status: 403 });
  }
  if (session.role === 'client' && job.client_id !== session.userId) {
    return NextResponse.json({ error: 'Not your job' }, { status: 403 });
  }

  // Validate transition
  const allowed = VALID_TRANSITIONS[job.status];
  if (!allowed || !allowed.includes(status)) {
    return NextResponse.json({ error: `Cannot transition from ${job.status} to ${status}` }, { status: 400 });
  }

  // Normalize status alias
  const normalizedStatus = STATUS_ALIASES[status] || status;

  const updates = { status: normalizedStatus };
  // Save photo to the correct field based on transition
  if (photoUrl) {
    if (status === 'pickup_confirmed' || status === 'picked_up') {
      updates.pickup_photo = photoUrl;
    } else if (status === 'delivered') {
      updates.delivery_photo = photoUrl;
    }
  }
  if (normalizedStatus === 'delivered' || status === 'delivered') updates.delivered_at = new Date().toISOString();
  if (normalizedStatus === 'confirmed' || normalizedStatus === 'completed') updates.completed_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('express_jobs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the other party with detailed status messages
  try {
    const notifyTarget = session.role === 'driver' ? job.client_id : job.assigned_driver_id;
    if (notifyTarget) {
      const statusMessages = {
        pickup_confirmed: { title: `Pickup confirmed - ${job.job_number}`, message: 'Driver has picked up your item and is heading to the delivery address.' },
        in_transit: { title: `In transit - ${job.job_number}`, message: 'Your delivery is on the way! Track it in real-time.' },
        delivered: { title: `Delivered - ${job.job_number}`, message: 'Your item has been delivered. Please confirm the delivery.' },
        confirmed: { title: `Confirmed - ${job.job_number}`, message: 'Delivery has been confirmed. Payment released to driver.' },
        completed: { title: `Completed - ${job.job_number}`, message: 'Job is now complete. Thank you for using TechChain Express!' },
      };
      const msg = statusMessages[normalizedStatus] || {
        title: `Job ${job.job_number || ''} updated`,
        message: `Status: ${normalizedStatus.replace(/_/g, ' ')}`,
      };

      await notify(notifyTarget, {
        type: 'status_update',
        category: 'delivery_status',
        title: msg.title,
        message: msg.message,
        referenceId: id,
      });
    }
  } catch {}

  return NextResponse.json({ data });
}

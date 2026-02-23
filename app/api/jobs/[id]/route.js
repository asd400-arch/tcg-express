import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

export async function GET(request, { params }) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('express_jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  // Clients can only see their own jobs, drivers can see assigned or open jobs
  if (session.role === 'client' && data.client_id !== session.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch driver info if assigned
  if (data.assigned_driver_id) {
    const { data: driver } = await supabaseAdmin
      .from('express_users')
      .select('contact_name, phone, vehicle_type, vehicle_plate, driver_rating')
      .eq('id', data.assigned_driver_id)
      .single();
    if (driver) {
      data.driver_name = driver.contact_name;
      data.driver_phone = driver.phone;
      data.vehicle_type = driver.vehicle_type;
      data.vehicle_plate = driver.vehicle_plate;
      data.driver_rating = driver.driver_rating;
    }
  }

  // Fetch client info for drivers
  if (session.role === 'driver' && data.client_id) {
    const { data: client } = await supabaseAdmin
      .from('express_users')
      .select('contact_name, phone, company_name, client_rating')
      .eq('id', data.client_id)
      .single();
    if (client) {
      data.client_name = client.contact_name;
      data.client_phone = client.phone;
      data.client_company = client.company_name;
      data.client_rating = client.client_rating;
    }
  }

  return NextResponse.json({ data });
}

// Editable fields by status group
const PRE_PICKUP_FIELDS = [
  'pickup_address', 'delivery_address',
  'pickup_contact', 'pickup_phone', 'pickup_instructions',
  'delivery_contact', 'delivery_phone', 'delivery_instructions',
  'item_description', 'item_weight', 'item_dimensions',
  'special_requirements',
];
const PENDING_ONLY_FIELDS = ['item_weight', 'item_dimensions'];
const POST_PICKUP_FIELDS = ['delivery_phone', 'delivery_instructions', 'special_requirements'];

export async function PUT(request, { params }) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'client') return NextResponse.json({ error: 'Only clients can edit jobs' }, { status: 403 });

  const { id } = await params;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // Fetch current job
  const { data: job, error: fetchErr } = await supabaseAdmin
    .from('express_jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  if (job.client_id !== session.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Determine allowed fields based on status
  const prePickupStatuses = ['open', 'bidding', 'pending', 'assigned'];
  const postPickupStatuses = ['pickup_confirmed', 'in_transit', 'delivered'];
  const noEditStatuses = ['confirmed', 'completed', 'cancelled', 'disputed'];

  if (noEditStatuses.includes(job.status)) {
    return NextResponse.json({ error: 'Job cannot be edited in its current status' }, { status: 400 });
  }

  let allowedFields;
  if (prePickupStatuses.includes(job.status)) {
    allowedFields = PRE_PICKUP_FIELDS;
  } else if (postPickupStatuses.includes(job.status)) {
    allowedFields = POST_PICKUP_FIELDS;
  } else {
    return NextResponse.json({ error: 'Job cannot be edited in its current status' }, { status: 400 });
  }

  // If status is assigned, don't allow changing package dimensions/weight
  if (job.status === 'assigned') {
    allowedFields = allowedFields.filter(f => !PENDING_ONLY_FIELDS.includes(f));
  }

  // Filter to only allowed fields that were actually provided
  const updates = {};
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 });
  }

  // Build audit log of what changed
  const changes = {};
  for (const [key, val] of Object.entries(updates)) {
    if (String(job[key] || '') !== String(val || '')) {
      changes[key] = { from: job[key], to: val };
    }
  }

  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ data: job, message: 'No changes detected' });
  }

  updates.updated_at = new Date().toISOString();

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('express_jobs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (updateErr) {
    console.error('Job update error:', updateErr.message, updateErr.code, updateErr.details, updateErr.hint);
    return NextResponse.json({ error: `Failed to update job: ${updateErr.message}` }, { status: 500 });
  }

  // Log the edit in job metadata (audit trail)
  try {
    await supabaseAdmin.from('express_notifications').insert({
      user_id: session.userId,
      type: 'job',
      title: `Job ${job.job_number} edited`,
      body: `Fields changed: ${Object.keys(changes).join(', ')}`,
      reference_id: id,
    });
  } catch {}

  // Notify assigned driver if addresses or important details changed
  if (job.assigned_driver_id) {
    const addressChanged = changes.pickup_address || changes.delivery_address;
    const contactChanged = changes.pickup_contact || changes.pickup_phone || changes.delivery_contact || changes.delivery_phone;
    const instructionsChanged = changes.pickup_instructions || changes.delivery_instructions || changes.special_requirements;

    if (addressChanged || contactChanged || instructionsChanged) {
      const changedLabels = [];
      if (changes.pickup_address) changedLabels.push('pickup address');
      if (changes.delivery_address) changedLabels.push('delivery address');
      if (changes.pickup_contact || changes.pickup_phone) changedLabels.push('pickup contact');
      if (changes.delivery_contact || changes.delivery_phone) changedLabels.push('delivery contact');
      if (changes.pickup_instructions) changedLabels.push('pickup instructions');
      if (changes.delivery_instructions) changedLabels.push('delivery instructions');
      if (changes.special_requirements) changedLabels.push('special requirements');

      try {
        const { notify } = await import('../../../../lib/notify.js');
        await notify(job.assigned_driver_id, {
          type: 'job',
          category: 'job_updates',
          title: `Job ${job.job_number} updated`,
          message: `Customer updated: ${changedLabels.join(', ')}. Please check the latest details.`,
          referenceId: id,
          url: '/driver/my-jobs',
        });
      } catch (e) {
        console.error('Failed to notify driver of job edit:', e.message);
      }
    }
  }

  return NextResponse.json({ data: updated, changes });
}

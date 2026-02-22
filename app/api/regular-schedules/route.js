import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { getSession } from '../../../lib/auth';

export async function GET(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let query = supabaseAdmin
    .from('regular_schedules')
    .select('*')
    .order('created_at', { ascending: false });

  if (session.role !== 'admin') {
    query = query.eq('customer_id', session.userId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'client') return NextResponse.json({ error: 'Only clients can create regular schedules' }, { status: 403 });

  const body = await request.json();

  if (!body.title || !body.locations || body.locations.length === 0) {
    return NextResponse.json({ error: 'Title and at least one location required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('regular_schedules')
    .insert([{
      customer_id: session.userId,
      title: body.title,
      description: body.description || null,
      frequency: body.frequency || 'weekly',
      day_of_week: body.day_of_week || null,
      time_slot: body.time_slot || '09:00',
      locations: body.locations,
      vehicle_mode: body.vehicle_mode || null,
      package_category: body.package_category || 'general',
      weight_range: body.weight_range || null,
      special_requirements: body.special_requirements || null,
      start_date: body.start_date || new Date().toISOString().split('T')[0],
      end_date: body.end_date || null,
      monthly_estimated_jobs: body.monthly_estimated_jobs || null,
      agreed_rate: body.agreed_rate ? parseFloat(body.agreed_rate) : null,
      is_active: true,
    }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

export async function GET(request) {
  const session = getSession(request);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('service_zones')
    .select('*')
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request) {
  const session = getSession(request);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const body = await request.json();
  const { name, description, zone_type, lat_min, lat_max, lng_min, lng_max, surcharge_rate, surcharge_flat, color } = body;

  if (!name || lat_min == null || lat_max == null || lng_min == null || lng_max == null) {
    return NextResponse.json({ error: 'Name and coordinates required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('service_zones')
    .insert([{
      name, description,
      zone_type: zone_type || 'coverage',
      lat_min, lat_max, lng_min, lng_max,
      surcharge_rate: surcharge_rate || 0,
      surcharge_flat: surcharge_flat || 0,
      color: color || '#3b82f6',
    }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function PATCH(request) {
  const session = getSession(request);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'Zone id required' }, { status: 400 });

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('service_zones')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(request) {
  const session = getSession(request);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Zone id required' }, { status: 400 });

  const { error } = await supabaseAdmin.from('service_zones').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

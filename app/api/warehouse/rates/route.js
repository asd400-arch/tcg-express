import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

export async function GET(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const status = searchParams.get('status') || 'active';

  let query = supabaseAdmin
    .from('warehouse_rates')
    .select('*')
    .order('sort_order', { ascending: true });

  if (status !== 'all') query = query.eq('status', status);
  if (category) query = query.eq('rate_category', category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request) {
  const session = getSession(request);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const body = await request.json();
  const { action } = body;

  if (action === 'create') {
    const { rate_name, rate_category, description, unit_price, unit_type, tier_pricing, min_order_value, sort_order } = body;

    if (!rate_name || !rate_category || unit_price == null) {
      return NextResponse.json({ error: 'rate_name, rate_category, and unit_price required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('warehouse_rates')
      .insert([{
        rate_name, rate_category, description,
        unit_price: parseFloat(unit_price),
        unit_type: unit_type || 'per_unit',
        tier_pricing: tier_pricing || null,
        min_order_value: min_order_value ? parseFloat(min_order_value) : 0,
        sort_order: sort_order || 0,
      }])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (action === 'update') {
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    delete updates.action;
    if (updates.unit_price != null) updates.unit_price = parseFloat(updates.unit_price);
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('warehouse_rates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (action === 'delete') {
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { error } = await supabaseAdmin.from('warehouse_rates').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

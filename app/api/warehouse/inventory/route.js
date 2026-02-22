import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

export async function GET(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'active';
  const search = searchParams.get('search') || '';
  const clientId = searchParams.get('client_id');

  let query = supabaseAdmin
    .from('warehouse_inventory')
    .select('*, client:client_id(contact_name, company_name)')
    .order('updated_at', { ascending: false });

  if (status !== 'all') query = query.eq('status', status);

  // Clients see only their own inventory
  if (session.role === 'client') {
    query = query.eq('client_id', session.userId);
  } else if (clientId) {
    query = query.eq('client_id', clientId);
  }

  if (search) {
    query = query.or(`sku.ilike.%${search}%,product_name.ilike.%${search}%,barcode.ilike.%${search}%`);
  }

  const { data, error } = await query.limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const body = await request.json();
  const { action } = body;

  if (action === 'create') {
    const { client_id, sku, product_name, description, category, quantity, min_stock_level, weight_kg, length_cm, width_cm, height_cm, warehouse_zone, rack_number, shelf_level, bin_code, barcode, unit_cost, unit_price, tags } = body;

    if (!client_id || !sku || !product_name) {
      return NextResponse.json({ error: 'client_id, sku, and product_name required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('warehouse_inventory')
      .insert([{
        client_id, sku, product_name, description, category,
        quantity: quantity || 0, min_stock_level: min_stock_level || 10,
        weight_kg, length_cm, width_cm, height_cm,
        warehouse_zone: warehouse_zone || 'A', rack_number, shelf_level, bin_code,
        barcode, unit_cost, unit_price, tags: tags || [],
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'SKU already exists for this client' }, { status: 400 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  }

  if (action === 'update') {
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    delete updates.action;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('warehouse_inventory')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (action === 'adjust_stock') {
    const { id, quantity_change, reference } = body;
    if (!id || quantity_change == null) return NextResponse.json({ error: 'id and quantity_change required' }, { status: 400 });

    const { data: item } = await supabaseAdmin
      .from('warehouse_inventory')
      .select('quantity')
      .eq('id', id)
      .single();

    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const newQty = item.quantity + parseInt(quantity_change);
    if (newQty < 0) return NextResponse.json({ error: 'Cannot reduce below zero' }, { status: 400 });

    await supabaseAdmin.from('warehouse_inventory')
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq('id', id);

    await supabaseAdmin.from('warehouse_stock_movements').insert([{
      inventory_id: id,
      movement_type: 'adjust',
      quantity_change: parseInt(quantity_change),
      quantity_before: item.quantity,
      quantity_after: newQty,
      reference: reference || 'Manual adjustment',
      performed_by: session.userId,
    }]);

    return NextResponse.json({ success: true, quantity: newQty });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

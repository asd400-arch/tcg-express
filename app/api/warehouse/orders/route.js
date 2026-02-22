import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

export async function GET(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const orderType = searchParams.get('type');
  const status = searchParams.get('status');
  const clientId = searchParams.get('client_id');

  let query = supabaseAdmin
    .from('warehouse_orders')
    .select('*, client:client_id(contact_name, company_name)')
    .order('created_at', { ascending: false });

  if (session.role === 'client') query = query.eq('client_id', session.userId);
  else if (clientId) query = query.eq('client_id', clientId);

  if (orderType) query = query.eq('order_type', orderType);
  if (status) query = query.eq('status', status);

  const { data, error } = await query.limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { action } = body;

  if (action === 'create') {
    const { client_id, order_type, items, origin_address, destination_address, contact_name, contact_phone, notes, special_instructions, expected_date } = body;

    if (!client_id || !order_type) {
      return NextResponse.json({ error: 'client_id and order_type required' }, { status: 400 });
    }

    const itemList = items || [];
    const totalItems = itemList.length;
    const totalQuantity = itemList.reduce((sum, i) => sum + (i.quantity || 0), 0);
    const subtotal = itemList.reduce((sum, i) => sum + ((i.unit_price || 0) * (i.quantity || 0)), 0);

    const { data, error } = await supabaseAdmin
      .from('warehouse_orders')
      .insert([{
        client_id,
        order_type,
        items: itemList,
        total_items: totalItems,
        total_quantity: totalQuantity,
        subtotal,
        total_amount: subtotal,
        origin_address, destination_address,
        contact_name, contact_phone,
        notes, special_instructions,
        expected_date,
        created_by: session.userId,
      }])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (action === 'update_status') {
    const { id, status } = body;
    if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const validStatuses = ['confirmed', 'processing', 'packed', 'shipped', 'received', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });

    const updates = { status, updated_at: new Date().toISOString() };
    const timestampField = `${status}_at`;
    if (['confirmed', 'processing', 'packed', 'shipped', 'received', 'completed'].includes(status)) {
      updates[timestampField] = new Date().toISOString();
    }

    // Process stock movements for received inbound orders
    if (status === 'received') {
      const { data: order } = await supabaseAdmin
        .from('warehouse_orders')
        .select('*')
        .eq('id', id)
        .single();

      if (order && order.order_type === 'inbound' && order.items) {
        for (const item of order.items) {
          if (item.inventory_id) {
            const { data: inv } = await supabaseAdmin
              .from('warehouse_inventory')
              .select('quantity')
              .eq('id', item.inventory_id)
              .single();

            if (inv) {
              const newQty = inv.quantity + (item.quantity || 0);
              await supabaseAdmin.from('warehouse_inventory')
                .update({ quantity: newQty, last_received_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq('id', item.inventory_id);

              await supabaseAdmin.from('warehouse_stock_movements').insert([{
                inventory_id: item.inventory_id,
                order_id: id,
                movement_type: 'receive',
                quantity_change: item.quantity || 0,
                quantity_before: inv.quantity,
                quantity_after: newQty,
                reference: `Inbound ${order.order_number}`,
                performed_by: session.userId,
              }]);
            }
          }
        }
      }
    }

    // Process stock movements for shipped outbound orders
    if (status === 'shipped') {
      const { data: order } = await supabaseAdmin
        .from('warehouse_orders')
        .select('*')
        .eq('id', id)
        .single();

      if (order && order.order_type === 'outbound' && order.items) {
        for (const item of order.items) {
          if (item.inventory_id) {
            const { data: inv } = await supabaseAdmin
              .from('warehouse_inventory')
              .select('quantity')
              .eq('id', item.inventory_id)
              .single();

            if (inv) {
              const newQty = Math.max(0, inv.quantity - (item.quantity || 0));
              await supabaseAdmin.from('warehouse_inventory')
                .update({ quantity: newQty, last_shipped_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq('id', item.inventory_id);

              await supabaseAdmin.from('warehouse_stock_movements').insert([{
                inventory_id: item.inventory_id,
                order_id: id,
                movement_type: 'ship',
                quantity_change: -(item.quantity || 0),
                quantity_before: inv.quantity,
                quantity_after: newQty,
                reference: `Outbound ${order.order_number}`,
                performed_by: session.userId,
              }]);
            }
          }
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .from('warehouse_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

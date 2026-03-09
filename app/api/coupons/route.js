import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { getSession } from '../../../lib/auth';

// GET: Admin list promo codes
export async function GET(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data } = await supabaseAdmin
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });

    return NextResponse.json({ data: data || [] });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST: Admin create promo code
export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { code, discount_type, discount_value, min_order_amount, max_discount, usage_limit, per_user_limit, valid_from, valid_until, new_customers_only, description } = body;

    if (!code || !discount_type || !discount_value) {
      return NextResponse.json({ error: 'code, discount_type, and discount_value are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.from('promo_codes').insert([{
      code: code.toUpperCase(),
      discount_type,
      discount_value: parseFloat(discount_value),
      min_order_amount: min_order_amount ? parseFloat(min_order_amount) : 0,
      max_discount: max_discount ? parseFloat(max_discount) : null,
      usage_limit: usage_limit ? parseInt(usage_limit) : null,
      per_user_limit: per_user_limit ? parseInt(per_user_limit) : 1,
      valid_from: valid_from || new Date().toISOString(),
      valid_until: valid_until || null,
      new_customers_only: new_customers_only || false,
      description: description || '',
      is_active: true,
      usage_count: 0,
    }]).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PATCH: Toggle coupon active status
export async function PATCH(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id, is_active } = await request.json();
    if (!id) return NextResponse.json({ error: 'Coupon id is required' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('promo_codes')
      .update({ is_active })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

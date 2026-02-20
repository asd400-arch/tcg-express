import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { getSession } from '../../../lib/auth';

// GET: Admin list coupons
export async function GET(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data } = await supabaseAdmin
    .from('express_coupons')
    .select('*')
    .order('created_at', { ascending: false });

  return NextResponse.json({ data: data || [] });
}

// POST: Admin create coupon
export async function POST(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const { code, type, value, min_order, max_discount, max_uses, expires_at, description } = body;

  if (!code || !type || !value) {
    return NextResponse.json({ error: 'code, type, and value are required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.from('express_coupons').insert([{
    code: code.toUpperCase(),
    type,
    value: parseFloat(value),
    min_order: min_order ? parseFloat(min_order) : 0,
    max_discount: max_discount ? parseFloat(max_discount) : null,
    max_uses: max_uses ? parseInt(max_uses) : null,
    expires_at: expires_at || null,
    description: description || '',
  }]).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

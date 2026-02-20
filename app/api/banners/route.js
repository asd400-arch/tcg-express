import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { getSession } from '../../../lib/auth';

// GET: Public banners (active only) or admin all
export async function GET(request) {
  const session = getSession(request);
  const { searchParams } = new URL(request.url);
  const all = searchParams.get('all') === 'true';

  let query = supabaseAdmin.from('express_promo_banners').select('*');

  if (!all || !session || session.role !== 'admin') {
    query = query.eq('is_active', true);
  }

  query = query.order('sort_order', { ascending: true });
  const { data } = await query;
  return NextResponse.json({ data: data || [] });
}

// POST: Admin create/update banner
export async function POST(request) {
  const session = getSession(request);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const { id, title, subtitle, image_url, link, bg_color, sort_order, is_active } = body;

  if (id) {
    // Update
    const { data, error } = await supabaseAdmin.from('express_promo_banners')
      .update({ title, subtitle, image_url, link, bg_color, sort_order, is_active })
      .eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  // Create
  const { data, error } = await supabaseAdmin.from('express_promo_banners').insert([{
    title, subtitle, image_url, link, bg_color: bg_color || '#3b82f6', sort_order: sort_order || 0, is_active: is_active !== false,
  }]).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { getSession } from '../../../lib/auth';

// GET: Public banners (active + within date range) or admin all
export async function GET(request) {
  try {
    const session = getSession(request);
    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all') === 'true';
    const isAdmin = session && session.role === 'admin';

    let query = supabaseAdmin.from('express_promo_banners').select('*');

    if (!all || !isAdmin) {
      const now = new Date().toISOString();
      query = query
        .eq('is_active', true)
        .or(`start_date.is.null,start_date.lte.${now}`)
        .or(`end_date.is.null,end_date.gte.${now}`);
    }

    query = query.order('sort_order', { ascending: true });
    const { data } = await query;
    return NextResponse.json({ data: data || [] });
  } catch (err) {
    console.error('GET /api/banners error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST: Admin create/update banner
export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { id, title, subtitle, image_url, link, deep_link, bg_color, sort_order, is_active, start_date, end_date } = body;

    if (id) {
      // Update
      const { data, error } = await supabaseAdmin.from('express_promo_banners')
        .update({ title, subtitle, image_url, link, deep_link, bg_color, sort_order, is_active, start_date: start_date || null, end_date: end_date || null })
        .eq('id', id).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }

    // Create
    const { data, error } = await supabaseAdmin.from('express_promo_banners').insert([{
      title, subtitle, image_url, link, deep_link, bg_color: bg_color || '#3b82f6', sort_order: sort_order || 0, is_active: is_active !== false, start_date: start_date || null, end_date: end_date || null,
    }]).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

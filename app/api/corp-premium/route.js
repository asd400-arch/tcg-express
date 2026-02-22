import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { getSession } from '../../../lib/auth';

export async function GET(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let query = supabaseAdmin
      .from('corp_premium_requests')
      .select('*, client:client_id(contact_name, company_name)')
      .order('created_at', { ascending: false });

    if (session.role === 'client') {
      query = query.eq('client_id', session.userId);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    console.error('GET /api/corp-premium error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'client') return NextResponse.json({ error: 'Only clients can create corp premium requests' }, { status: 403 });

    const body = await request.json();

    const { data, error } = await supabaseAdmin
      .from('corp_premium_requests')
      .insert([{
        client_id: session.userId,
        title: body.title,
        description: body.description || null,
        start_date: body.start_date || null,
        end_date: body.end_date || null,
        estimated_budget: body.estimated_budget ? parseFloat(body.estimated_budget) : null,
        locations: body.locations || [],
        vehicle_modes: body.vehicle_modes || [],
        special_requirements: body.special_requirements || null,
        certifications_required: body.certifications || [],
        min_fleet_size: body.min_fleet_size || 1,
        min_rating: body.min_rating || 4.5,
        nda_accepted: body.nda_accepted || false,
        status: body.nda_accepted ? 'bidding_open' : 'nda_pending',
      }])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    console.error('POST /api/corp-premium error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

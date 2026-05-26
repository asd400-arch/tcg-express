import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

export async function GET(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'driver') {
      return NextResponse.json({ error: 'Drivers only' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabaseAdmin
      .from('express_jobs')
      .select('*')
      .eq('assigned_driver_id', session.userId);

    if (status === 'active') {
      query = query.in('status', ['assigned', 'pickup_confirmed', 'in_transit']);
    } else if (status) {
      query = query.eq('status', status);
    }

    query = query.order('pickup_by', { ascending: true, nullsFirst: false });

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data: data || [] });
  } catch (err) {
    console.error('GET /api/driver/my-jobs error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

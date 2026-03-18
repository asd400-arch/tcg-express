import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { getSession } from '../../../lib/auth';

// Public endpoint: returns active service zones (for geo-fencing on job creation)
export async function GET(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const country = request.nextUrl.searchParams.get('country') || session.country || 'sg';

    const { data, error } = await supabaseAdmin
      .from('service_zones')
      .select('id, name, zone_type, lat_min, lat_max, lng_min, lng_max, surcharge_rate, surcharge_flat')
      .eq('is_active', true)
      .eq('country', country)
      .order('name', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

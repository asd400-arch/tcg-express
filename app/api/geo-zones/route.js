import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { getSession } from '../../../lib/auth';

// Returns the active service zones used for geo-fencing on job creation.
//
// The live `service_zones` table does not have `is_active` or `country`
// columns (it has `status`), so we select everything and filter in JS.
// That keeps this endpoint working whichever shape the table has.
export async function GET(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const country = (request.nextUrl.searchParams.get('country') || session.country || 'sg').toLowerCase();

    const { data, error } = await supabaseAdmin
      .from('service_zones')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('[GEO-ZONES] query error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const zones = (data || []).filter(z => {
      // Inactive only when the row says so explicitly.
      if (z.is_active === false) return false;
      if (typeof z.status === 'string' && z.status.toLowerCase() !== 'active') return false;
      // Only filter by country when the column exists and is set.
      if (typeof z.country === 'string' && z.country && z.country.toLowerCase() !== country) return false;
      return true;
    }).map(z => ({
      id: z.id,
      name: z.name,
      zone_type: z.zone_type,
      lat_min: z.lat_min,
      lat_max: z.lat_max,
      lng_min: z.lng_min,
      lng_max: z.lng_max,
      surcharge_rate: z.surcharge_rate,
      surcharge_flat: z.surcharge_flat,
    }));

    return NextResponse.json({ data: zones });
  } catch (err) {
    console.error('[GEO-ZONES] error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

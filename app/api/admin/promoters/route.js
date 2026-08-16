import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

// ---------------------------------------------------------------------------
// GET — list promoters (from promoter_summary view) + zones for form
// ---------------------------------------------------------------------------

export async function GET(request) {
  const session = getSession(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { data: promoters, error } = await supabaseAdmin
    .from('promoter_summary')
    .select('*');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also fetch zones for the add/edit form
  const { data: zones } = await supabaseAdmin
    .from('zone_campaign_zones')
    .select('id, zone_key')
    .order('zone_key');

  return NextResponse.json({ data: promoters || [], zones: zones || [] });
}

// ---------------------------------------------------------------------------
// POST — create promoter with auto-generated code
// ---------------------------------------------------------------------------

const ALLOWED_FIELDS = ['full_name', 'phone', 'zone_id', 'hourly_rate', 'bonus_per_signup', 'daily_bonus_cap', 'is_active'];

export async function POST(request) {
  const session = getSession(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();

    if (!body.full_name || !body.zone_id) {
      return NextResponse.json({ error: 'full_name and zone_id are required' }, { status: 400 });
    }

    // Whitelist fields
    const safe = {};
    for (const k of ALLOWED_FIELDS) {
      if (body[k] !== undefined) safe[k] = body[k];
    }

    // Look up zone_key for code generation
    const { data: zone } = await supabaseAdmin
      .from('zone_campaign_zones')
      .select('zone_key')
      .eq('id', safe.zone_id)
      .maybeSingle();

    if (!zone) {
      return NextResponse.json({ error: 'Invalid zone_id' }, { status: 400 });
    }

    // Find next available number for this zone
    const prefix = `${zone.zone_key}-P`;
    const { data: existing } = await supabaseAdmin
      .from('promoters')
      .select('code')
      .ilike('code', `${prefix}%`)
      .order('code', { ascending: false });

    let nextNum = 1;
    if (existing && existing.length > 0) {
      // Extract max number from existing codes
      for (const p of existing) {
        const suffix = p.code.toUpperCase().replace(prefix.toUpperCase(), '');
        const num = parseInt(suffix, 10);
        if (!isNaN(num) && num >= nextNum) nextNum = num + 1;
      }
    }

    // Try inserting with retry on unique collision (max 5 attempts)
    let inserted = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = `${prefix}${String(nextNum + attempt).padStart(2, '0')}`;
      const { data, error } = await supabaseAdmin
        .from('promoters')
        .insert({ ...safe, code })
        .select()
        .maybeSingle();

      if (!error && data) {
        inserted = data;
        break;
      }
      // If unique violation, try next number
      if (error && error.code === '23505') continue;
      // Other error — fail
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    if (!inserted) {
      return NextResponse.json({ error: 'Failed to generate unique code after 5 attempts' }, { status: 500 });
    }

    return NextResponse.json({ data: inserted });
  } catch (err) {
    console.error('[promoters] create error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH — update promoter
// ---------------------------------------------------------------------------

const UPDATABLE_FIELDS = ['full_name', 'phone', 'hourly_rate', 'bonus_per_signup', 'daily_bonus_cap', 'is_active'];

export async function PATCH(request) {
  const session = getSession(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updates = {};
    for (const k of UPDATABLE_FIELDS) {
      if (body[k] !== undefined) updates[k] = body[k];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('promoters')
      .update(updates)
      .eq('id', body.id)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('[promoters] update error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

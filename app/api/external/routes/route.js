export const runtime = 'nodejs';

// POST /api/external/routes
// A B2B partner (TCG Fresh) pushes one morning delivery route: one pickup, N stops.
// The route is assigned straight to the zone's dedicated driver at a fixed fare. No bidding.
// Each stop becomes an express_jobs row so the driver app, POD and status machine are reused unchanged.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { notify } from '../../../../lib/notify';

const SGT = '+08:00';

async function validateApiKey(request) {
  const auth = request.headers.get('Authorization');
  const apiKey = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!apiKey) return null;
  const { data } = await supabaseAdmin
    .from('external_api_keys').select('*').eq('api_key', apiKey).eq('is_active', true).single();
  if (data) {
    supabaseAdmin.from('external_api_keys')
      .update({ last_used_at: new Date().toISOString() }).eq('id', data.id).then(() => {});
  }
  return data;
}

async function setting(key, fallback) {
  const { data } = await supabaseAdmin.from('express_settings').select('value').eq('key', key).maybeSingle();
  const v = parseFloat(data?.value);
  return Number.isFinite(v) ? v : fallback;
}

// Resolve zone: explicit zone_id > zone name > bounding box of first stop with lat/lng
async function resolveZone(body) {
  const { data: zones } = await supabaseAdmin.from('service_zones').select('*').eq('status', 'active');
  if (!zones?.length) return null;
  if (body.zone_id) return zones.find(z => z.id === body.zone_id) || null;
  if (body.zone) {
    const q = String(body.zone).toLowerCase();
    return zones.find(z => z.name.toLowerCase().includes(q)) || null;
  }
  const s = (body.stops || []).find(x => x.lat && x.lng);
  if (s) {
    return zones.find(z => s.lat >= z.lat_min && s.lat <= z.lat_max && s.lng >= z.lng_min && s.lng <= z.lng_max) || null;
  }
  return null;
}

// Dedicated driver first, then backup. Only cold-capable drivers for frozen/chilled routes.
async function pickDriver(zoneId, temperature) {
  if (!zoneId) return null;
  let q = supabaseAdmin.from('express_users')
    .select('id, contact_name, zone_role, cold_capable')
    .eq('role', 'driver').eq('dedicated_zone_id', zoneId).in('zone_role', ['dedicated', 'backup']);
  if (temperature && temperature !== 'ambient') q = q.eq('cold_capable', true);
  const { data } = await q;
  if (!data?.length) return null;
  return data.find(d => d.zone_role === 'dedicated') || data.find(d => d.zone_role === 'backup') || null;
}

function slotToTimes(date, slot) {
  // '07:30-08:30' on YYYY-MM-DD → ISO start/end in SGT
  const [a, b] = String(slot || '').split('-');
  const mk = t => (t ? new Date(`${date}T${t.trim()}:00${SGT}`).toISOString() : null);
  return { start: mk(a), end: mk(b) };
}

export async function POST(request) {
  try {
    const key = await validateApiKey(request);
    if (!key) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
    if (!key.client_id) return NextResponse.json({ error: 'API key not linked to a client account' }, { status: 400 });

    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const missing = [];
    if (!body.external_ref) missing.push('external_ref');
    if (!body.date) missing.push('date');
    if (!body.pickup?.address) missing.push('pickup.address');
    if (!Array.isArray(body.stops) || !body.stops.length) missing.push('stops[]');
    (body.stops || []).forEach((s, i) => { if (!s.address) missing.push(`stops[${i}].address`); if (!s.external_ref) missing.push(`stops[${i}].external_ref`); });
    if (missing.length) return NextResponse.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 });

    // Idempotent on (partner, external_ref)
    const { data: existing } = await supabaseAdmin.from('partner_routes')
      .select('id, status, assigned_driver_id').eq('partner', key.source).eq('external_ref', body.external_ref).maybeSingle();
    if (existing) {
      const { data: jobs } = await supabaseAdmin.from('express_jobs').select('id, external_order_id, status').eq('partner_route_id', existing.id).order('stop_seq');
      return NextResponse.json({ success: true, duplicate: true, route_id: existing.id, status: existing.status, driver_id: existing.assigned_driver_id, jobs }, { status: 200 });
    }

    const temperature = ['ambient', 'chilled', 'frozen', 'mixed'].includes(body.temperature) ? body.temperature : 'ambient';
    const zone = await resolveZone(body);
    const driver = await pickDriver(zone?.id, temperature);

    const baseFare = await setting('partner_base_fare', 25);
    const stopFare = await setting('partner_stop_fare', 6);
    const stopCount = body.stops.length;
    const totalFare = Math.round((baseFare + stopFare * stopCount) * 100) / 100;
    const perStop = Math.round((totalFare / stopCount) * 100) / 100;

    const pickup = slotToTimes(body.date, body.pickup_slot || '07:30-08:30');

    const { data: route, error: rErr } = await supabaseAdmin.from('partner_routes').insert([{
      partner: key.source, external_ref: body.external_ref, api_key_id: key.id, client_id: key.client_id,
      zone_id: zone?.id || null, route_date: body.date, pickup_slot: body.pickup_slot || '07:30-08:30', temperature,
      pickup_address: body.pickup.address, pickup_contact: body.pickup.contact || null, pickup_phone: body.pickup.phone || null,
      pickup_instructions: body.pickup.instructions || null,
      stop_count: stopCount, base_fare: baseFare, stop_fare: stopFare, total_fare: totalFare,
      assigned_driver_id: driver?.id || null, status: driver ? 'assigned' : 'unassigned',
    }]).select().single();
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

    const jobRows = body.stops.map((s, i) => {
      const win = slotToTimes(body.date, s.window || '09:00-12:00');
      return {
        client_id: key.client_id,
        status: driver ? 'assigned' : 'open',
        assigned_driver_id: driver?.id || null,
        job_type: 'spot', delivery_mode: 'express', manpower_count: 1, equipment_needed: [],
        pickup_address: body.pickup.address, pickup_contact: body.pickup.contact || null, pickup_phone: body.pickup.phone || null,
        pickup_instructions: body.pickup.instructions || null,
        delivery_address: s.address, delivery_lat: s.lat ?? null, delivery_lng: s.lng ?? null,
        delivery_contact: s.contact || null, delivery_phone: s.phone || null, delivery_instructions: s.instructions || null,
        delivery_window: s.window || '09:00-12:00',
        item_description: s.items_summary || 'TCG Fresh order', item_category: 'food',
        item_weight: s.weight_kg ?? null,
        urgency: 'standard', vehicle_required: 'any',
        budget_min: perStop, budget_max: perStop, final_amount: perStop,
        fare_mode: 'fixed', fixed_fare: perStop, temperature,
        pickup_by: pickup.start, deliver_by: win.end,
        external_source: key.source, external_order_id: String(s.external_ref), external_api_key_id: key.id,
        partner_route_id: route.id, stop_seq: i + 1,
        fare_breakdown: { base_fare: perStop, urgency_surcharge: 0, distance_surcharge: 0, addon_total: 0, save_mode_discount: 0, ev_discount: 0, promo_discount: 0, total: perStop, source: 'partner_fixed' },
      };
    });

    const { data: jobs, error: jErr } = await supabaseAdmin.from('express_jobs').insert(jobRows).select('id, job_number, external_order_id, status, stop_seq');
    if (jErr) {
      await supabaseAdmin.from('partner_routes').delete().eq('id', route.id);
      return NextResponse.json({ error: jErr.message }, { status: 500 });
    }

    // One notification for the whole route (not one per stop)
    try {
      if (driver) {
        await notify(driver.id, {
          type: 'job', category: 'job_updates',
          title: `${key.source === 'tcg_fresh' ? 'TCG Fresh' : key.source} route ${body.date}`,
          message: `${stopCount} stops · pickup ${route.pickup_slot} · $${totalFare.toFixed(2)} fixed. Open My Jobs.`,
          referenceId: route.id, url: '/driver/my-jobs', data: { route_id: route.id, role: 'driver' },
        });
      } else {
        // No dedicated driver for this zone: tell admins (all admin users)
        const { data: admins } = await supabaseAdmin.from('express_users').select('id').eq('role', 'admin');
        await Promise.allSettled((admins || []).map(a => notify(a.id, {
          type: 'job', category: 'job_updates',
          title: `Unassigned partner route ${body.external_ref}`,
          message: `${key.source}: ${stopCount} stops on ${body.date}, zone ${zone?.name || 'unknown'} has no dedicated driver.`,
          referenceId: route.id, url: '/admin/jobs', data: { route_id: route.id },
        })));
      }
    } catch {}

    return NextResponse.json({
      success: true, route_id: route.id, status: route.status, zone: zone?.name || null,
      driver: driver ? { id: driver.id, name: driver.contact_name } : null,
      total_fare: totalFare, jobs,
    }, { status: 201 });
  } catch (err) {
    console.error('[EXTERNAL-ROUTES] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/external/routes?external_ref=...  |  ?route_id=...
export async function GET(request) {
  const key = await validateApiKey(request);
  if (!key) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sp = new URL(request.url).searchParams;
  let q = supabaseAdmin.from('partner_routes').select('*').eq('partner', key.source);
  if (sp.get('route_id')) q = q.eq('id', sp.get('route_id'));
  else if (sp.get('external_ref')) q = q.eq('external_ref', sp.get('external_ref'));
  else return NextResponse.json({ error: 'Provide route_id or external_ref' }, { status: 400 });
  const { data: route } = await q.maybeSingle();
  if (!route) return NextResponse.json({ error: 'Route not found' }, { status: 404 });
  const { data: jobs } = await supabaseAdmin.from('express_jobs')
    .select('id, job_number, external_order_id, status, stop_seq, delivery_address, delivered_at, delivery_photo, customer_signature_url')
    .eq('partner_route_id', route.id).order('stop_seq');
  return NextResponse.json({ route, jobs });
}

// DELETE /api/external/routes?route_id=...  — only before any stop has started
export async function DELETE(request) {
  const key = await validateApiKey(request);
  if (!key) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const routeId = new URL(request.url).searchParams.get('route_id');
  if (!routeId) return NextResponse.json({ error: 'route_id required' }, { status: 400 });
  const { data: route } = await supabaseAdmin.from('partner_routes').select('id, status, assigned_driver_id, external_ref').eq('id', routeId).eq('partner', key.source).maybeSingle();
  if (!route) return NextResponse.json({ error: 'Route not found' }, { status: 404 });
  if (!['unassigned', 'assigned'].includes(route.status)) return NextResponse.json({ error: `Route already ${route.status}` }, { status: 400 });
  const now = new Date().toISOString();
  await supabaseAdmin.from('express_jobs').update({ status: 'cancelled', cancelled_at: now, cancelled_by: 'partner' }).eq('partner_route_id', route.id);
  await supabaseAdmin.from('partner_routes').update({ status: 'cancelled', updated_at: now }).eq('id', route.id);
  try {
    if (route.assigned_driver_id) await notify(route.assigned_driver_id, { type: 'job', category: 'job_updates', title: 'Route cancelled', message: `Partner route ${route.external_ref} was cancelled.`, referenceId: route.id, url: '/driver/my-jobs', data: { route_id: route.id, role: 'driver' } });
  } catch {}
  return NextResponse.json({ success: true });
}

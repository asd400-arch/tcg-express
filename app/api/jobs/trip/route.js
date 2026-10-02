import { NextResponse, after } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';
import { cleanString } from '../../../../lib/validate';
import { loadRateCard, dropPrice } from '../../../../lib/contract';
import { composeAddress, NO_UNIT_LABEL, MIN_PICKUP_LEAD_MIN, minPickupMessage } from '../../../../lib/job-rules';
import { resolveDriverCode, driverShortName } from '../../../../lib/driver-pool';
import { alertDriversAboutJob, isSchemaMissing } from '../../../../lib/dispatch';
import { getAreaName } from '../../../../lib/job-helpers';
import { alertNewJob } from '../../../../lib/admin-alerts';

const MAX_DROPS = 60;
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

// GET  /api/jobs/trip — the signed-in customer's active rate card (or null)
export async function GET(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'client') return NextResponse.json({ data: null });
  const card = await loadRateCard(session.userId);
  if (!card) return NextResponse.json({ data: null });
  return NextResponse.json({
    data: {
      label: card.label, vehicle: card.vehicle, first_drop_sgd: r2(card.first_drop_sgd), next_drop_sgd: r2(card.next_drop_sgd),
      driver_pool: card.driver_pool, billing: card.billing, payment_terms_days: card.payment_terms_days,
    },
  });
}

/**
 * POST /api/jobs/trip — contract customers post one pickup with several drops (2 Oct 2026).
 * Priced from the rate card (first drop / each additional drop), billed on the monthly invoice,
 * offered as ONE trip: the first driver to accept gets every drop.
 * body: { pickup: {address, blk?, unit, no_unit?, contact, phone, instructions?}, pickup_by,
 *         item_description?, drops: [{address, blk?, unit, no_unit?, contact, phone, instructions?, item?}],
 *         driver_code? }
 */
export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'client') return NextResponse.json({ error: 'Only customers can post deliveries' }, { status: 403 });

    const card = await loadRateCard(session.userId);
    if (!card) return NextResponse.json({ error: 'Contract ordering is not set up for your account. Contact TCG Express.' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const p = body.pickup || {};
    const drops = Array.isArray(body.drops) ? body.drops : [];
    if (!drops.length) return NextResponse.json({ error: 'Add at least one drop' }, { status: 400 });
    if (drops.length > MAX_DROPS) return NextResponse.json({ error: `Up to ${MAX_DROPS} drops per trip` }, { status: 400 });

    const s = (v, n = 300) => (cleanString(v == null ? '' : String(v), n) || '').trim();
    const unitOf = (x) => (x?.no_unit ? NO_UNIT_LABEL : s(x?.unit, 40));

    if (!s(p.address)) return NextResponse.json({ error: 'Pickup address is required' }, { status: 400 });
    if (!unitOf(p)) return NextResponse.json({ error: 'Pickup unit no. is required (or tick "No unit")', code: 'pickup_unit_required' }, { status: 400 });
    if (!s(p.contact, 80) || !s(p.phone, 30)) return NextResponse.json({ error: 'Pickup contact name and phone are required' }, { status: 400 });

    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      const n = i + 1;
      if (!s(d?.address)) return NextResponse.json({ error: `Drop ${n}: address is required`, drop: n }, { status: 400 });
      if (!unitOf(d)) return NextResponse.json({ error: `Drop ${n}: unit no. is required (or tick "No unit")`, drop: n, code: 'delivery_unit_required' }, { status: 400 });
      if (!s(d?.contact, 80) || !s(d?.phone, 30)) return NextResponse.json({ error: `Drop ${n}: contact name and phone are required`, drop: n }, { status: 400 });
    }

    const pickupBy = body.pickup_by ? new Date(body.pickup_by) : null;
    if (!pickupBy || Number.isNaN(pickupBy.getTime())) return NextResponse.json({ error: 'Choose a pickup time' }, { status: 400 });
    if (pickupBy.getTime() < Date.now() + (MIN_PICKUP_LEAD_MIN - 1) * 60000) {
      return NextResponse.json({ error: minPickupMessage(), code: 'pickup_too_soon' }, { status: 400 });
    }

    // Who drives: the card's pool, or one driver by code
    let pool = card.driver_pool === 'open' ? 'open' : 'tcg';
    let target = null;
    if (body.driver_code) {
      const r = await resolveDriverCode(body.driver_code);
      if (r.error) return NextResponse.json({ error: r.error, code: 'driver_code_invalid' }, { status: r.status || 400 });
      target = r.driver;
      pool = 'direct';
    }

    const tripId = randomUUID();
    const pickupAddress = composeAddress(p.address, p.blk, unitOf(p));
    const defaultItem = s(body.item_description, 200) || 'Parcel';
    const rows = drops.map((d, i) => {
      const price = dropPrice(card, i + 1);
      return {
        client_id: session.userId,
        status: 'open',
        item_category: 'general',
        item_description: s(d.item, 200) || defaultItem,
        pickup_address: pickupAddress,
        pickup_contact: s(p.contact, 80),
        pickup_phone: s(p.phone, 30),
        pickup_instructions: s(p.instructions, 500) || null,
        delivery_address: composeAddress(d.address, d.blk, unitOf(d)),
        delivery_contact: s(d.contact, 80),
        delivery_phone: s(d.phone, 30),
        delivery_instructions: s(d.instructions, 500) || null,
        special_requirements: JSON.stringify({ contract: true, rate_card: card.label, trip_drops: drops.length, drop: i + 1 }),
        equipment_needed: [],
        urgency: 'standard',
        budget_min: price,
        budget_max: price,
        pickup_by: pickupBy.toISOString(),
        manpower_count: 1,
        vehicle_required: card.vehicle || 'any',
        job_type: 'spot',
        delivery_mode: 'express',
        item_photos: [],
        coupon_discount: 0,
        consolidation_group_id: tripId,
        is_consolidated: drops.length > 1,
        queue_position: i + 1,
        trip_seq: i + 1,
        billing_mode: 'invoice',
        rate_card_id: card.id,
        driver_pool: pool,
        target_driver_id: target ? target.id : null,
      };
    });

    const { data: jobs, error } = await supabaseAdmin.from('express_jobs').insert(rows).select('*');
    if (error) {
      if (isSchemaMissing(error)) return NextResponse.json({ error: 'Contract ordering is being switched on — please try again shortly.' }, { status: 503 });
      console.error('[trip] insert failed:', error.message);
      return NextResponse.json({ error: 'Could not create the trip. Please try again.' }, { status: 500 });
    }
    const sorted = (jobs || []).sort((a, b) => (a.trip_seq || 0) - (b.trip_seq || 0));
    const first = sorted[0];
    const total = r2(sorted.reduce((sum, j) => sum + Number(j.budget_min || 0), 0));

    // One alert for the whole trip, to the drivers allowed by the pool
    const area = getAreaName(pickupAddress);
    after(async () => {
      try {
        await alertDriversAboutJob(first, {
          title: target ? `📌 ${sorted.length}-drop trip booked for you` : `🚚 ${sorted.length}-drop trip from ${area}`,
          body: `${first.job_number}${sorted.length > 1 ? ` +${sorted.length - 1}` : ''} | S$${total.toFixed(2)} total | pickup ${pickupBy.toLocaleString('en-SG', { timeZone: 'Asia/Singapore', hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' })}`,
          inAppTitle: `Trip: ${sorted.length} drop${sorted.length > 1 ? 's' : ''} from ${area}`,
          inAppBody: `Accept once and every drop is yours · ${first.job_number}`,
        });
      } catch (e) { console.error('[trip] driver alert failed:', e?.message); }
      try { await alertNewJob({ ...first, item_description: `${sorted.length}-drop contract trip (S$${total.toFixed(2)})` }, {}); } catch { /* non-critical */ }
    });

    return NextResponse.json({
      data: {
        trip_id: tripId,
        drops: sorted.length,
        total_sgd: total,
        jobs: sorted.map((j) => ({ id: j.id, job_number: j.job_number, price: Number(j.budget_min), delivery_address: j.delivery_address })),
        driver: target ? driverShortName(target.contact_name) : null,
      },
    });
  } catch (err) {
    console.error('POST /api/jobs/trip error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

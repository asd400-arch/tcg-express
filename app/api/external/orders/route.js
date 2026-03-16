export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';

// ── API Key 검증 ──
async function validateApiKey(request) {
  const authHeader = request.headers.get('Authorization');
  const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!apiKey) return null;

  const { data: keyRecord } = await supabaseAdmin
    .from('external_api_keys')
    .select('*')
    .eq('api_key', apiKey)
    .eq('is_active', true)
    .single();

  if (!keyRecord) return null;

  // last_used_at + total_orders 업데이트 (fire and forget)
  supabaseAdmin.from('external_api_keys').update({
    last_used_at: new Date().toISOString(),
    total_orders: (keyRecord.total_orders || 0) + 1,
  }).eq('id', keyRecord.id).then(() => {});

  return keyRecord;
}

// ── 외부 소스별 payload 정규화 ──
function normalizeOrder(body, source) {
  // 각 플랫폼 포맷 → TCG 내부 포맷 변환
  switch (source) {
    case 'shopify': {
      const shipping = body.shipping_address || {};
      const billing = body.billing_address || {};
      const lineItems = (body.line_items || []).map(i => i.title).join(', ');
      return {
        item_description: lineItems || body.note || 'Shopify Order',
        item_category: 'electronics',
        pickup_address: body.pickup_address || '',
        pickup_contact: body.pickup_contact || '',
        pickup_phone: body.pickup_phone || '',
        delivery_address: [shipping.address1, shipping.address2, shipping.city, shipping.zip].filter(Boolean).join(', '),
        delivery_contact: `${shipping.first_name || ''} ${shipping.last_name || ''}`.trim(),
        delivery_phone: shipping.phone || '',
        delivery_instructions: body.note || null,
        item_weight: parseFloat(body.total_weight) / 1000 || null, // grams → kg
        budget_min: parseFloat(body.budget_min) || parseFloat(body.shipping_lines?.[0]?.price) || 10,
        budget_max: parseFloat(body.budget_max) || parseFloat(body.shipping_lines?.[0]?.price) || 20,
        urgency: body.urgency || 'standard',
        pickup_by: body.pickup_by || null,
        external_order_id: String(body.id || body.order_id || ''),
      };
    }
    case 'lazada': {
      return {
        item_description: body.item_name || body.product_name || 'Lazada Order',
        item_category: 'electronics',
        pickup_address: body.pickup_address || '',
        pickup_contact: body.pickup_contact || '',
        pickup_phone: body.pickup_phone || '',
        delivery_address: body.delivery_address || body.address?.full_address || '',
        delivery_contact: body.buyer_name || body.delivery_contact || '',
        delivery_phone: body.buyer_phone || body.delivery_phone || '',
        delivery_instructions: body.remarks || null,
        item_weight: parseFloat(body.weight_kg) || null,
        budget_min: parseFloat(body.budget_min) || 10,
        budget_max: parseFloat(body.budget_max) || 20,
        urgency: body.urgency || 'standard',
        pickup_by: body.pickup_deadline || null,
        external_order_id: String(body.order_id || body.trade_order_id || ''),
      };
    }
    case 'shopee': {
      return {
        item_description: (body.items || []).map(i => i.item_name).join(', ') || 'Shopee Order',
        item_category: 'electronics',
        pickup_address: body.pickup_address || '',
        pickup_contact: body.pickup_contact || '',
        pickup_phone: body.pickup_phone || '',
        delivery_address: body.recipient?.full_address || body.delivery_address || '',
        delivery_contact: body.recipient?.name || '',
        delivery_phone: body.recipient?.phone || '',
        delivery_instructions: body.message_to_seller || null,
        item_weight: parseFloat(body.package_weight) || null,
        budget_min: parseFloat(body.budget_min) || 10,
        budget_max: parseFloat(body.budget_max) || 20,
        urgency: body.urgency || 'standard',
        pickup_by: body.ship_by_date || null,
        external_order_id: String(body.order_sn || body.order_id || ''),
      };
    }
    default: {
      // Generic / Easyship / Shippit / 기타
      return {
        item_description: body.item_description || body.description || body.title || 'External Order',
        item_category: body.item_category || body.category || 'general',
        pickup_address: body.pickup_address || '',
        pickup_contact: body.pickup_contact || '',
        pickup_phone: body.pickup_phone || '',
        delivery_address: body.delivery_address || '',
        delivery_contact: body.delivery_contact || '',
        delivery_phone: body.delivery_phone || '',
        pickup_instructions: body.pickup_instructions || null,
        delivery_instructions: body.delivery_instructions || null,
        item_weight: body.weight_kg != null ? parseFloat(body.weight_kg) : (body.item_weight != null ? parseFloat(body.item_weight) : null),
        item_dimensions: body.dimensions || body.item_dimensions || null,
        budget_min: parseFloat(body.budget_min) || parseFloat(body.budget) || 10,
        budget_max: parseFloat(body.budget_max) || parseFloat(body.budget) || 20,
        urgency: body.urgency || 'standard',
        pickup_by: body.pickup_by || body.pickup_date || null,
        deliver_by: body.deliver_by || null,
        vehicle_required: body.vehicle_required || 'any',
        external_order_id: String(body.external_order_id || body.order_id || body.id || ''),
      };
    }
  }
}

// ── POST /api/external/orders ──
export async function POST(request) {
  try {
    const keyRecord = await validateApiKey(request);
    if (!keyRecord) {
      return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
    }

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const source = keyRecord.source;
    const normalized = normalizeOrder(body, source);

    // 필수 필드 검증
    const missing = [];
    if (!normalized.pickup_address) missing.push('pickup_address');
    if (!normalized.delivery_address) missing.push('delivery_address');
    if (!normalized.item_description) missing.push('item_description');
    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 });
    }

    // 중복 주문 체크
    if (normalized.external_order_id) {
      const { data: existing } = await supabaseAdmin
        .from('express_jobs')
        .select('id, job_number, status')
        .eq('external_source', source)
        .eq('external_order_id', normalized.external_order_id)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({
          success: false,
          error: 'Duplicate order',
          existing: { id: existing.id, job_number: existing.job_number, status: existing.status },
        }, { status: 409 });
      }
    }

    // 픽업 시간 검증
    if (normalized.pickup_by) {
      const pickupTime = new Date(normalized.pickup_by);
      const minPickup = new Date(Date.now() + 29 * 60000);
      if (pickupTime < minPickup) {
        return NextResponse.json({ error: 'Pickup time must be at least 30 minutes from now' }, { status: 400 });
      }
    }

    // 기본 client_id: external_api_keys 테이블의 client_id (없으면 system client)
    const clientId = keyRecord.client_id || null;
    if (!clientId) {
      return NextResponse.json({ error: 'API key not linked to a client account. Contact TCG admin.' }, { status: 400 });
    }

    // Job 생성
    const jobData = {
      client_id: clientId,
      status: 'open',
      job_type: 'spot',
      delivery_mode: 'express',
      manpower_count: 1,
      equipment_needed: [],
      ...normalized,
      external_source: source,
      external_api_key_id: keyRecord.id,
      vehicle_required: normalized.vehicle_required || 'any',
      urgency: normalized.urgency || 'standard',
    };

    const { data: job, error } = await supabaseAdmin
      .from('express_jobs')
      .insert([jobData])
      .select()
      .single();

    if (error) {
      console.error('[EXTERNAL-ORDERS] Insert error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 드라이버 푸시 알림
    try {
      const { data: subs } = await supabaseAdmin
        .from('express_push_subscriptions').select('user_id');
      if (subs?.length > 0) {
        const { sendPushToUser } = await import('../../../../lib/web-push.js');
        const uniqueIds = [...new Set(subs.map(s => s.user_id))];
        await Promise.allSettled(uniqueIds.map(uid =>
          sendPushToUser(uid, {
            title: '🚚 New Job Available',
            body: `${job.job_number} | ${jobData.budget_min}-${jobData.budget_max} | ${source.toUpperCase()}`,
            url: '/driver/jobs',
          })
        ));
      }
    } catch {}

    return NextResponse.json({
      success: true,
      job_id: job.id,
      job_number: job.job_number,
      status: job.status,
      tracking_url: `https://app.techchainglobal.com/track/${job.id}`,
    }, { status: 201 });

  } catch (err) {
    console.error('[EXTERNAL-ORDERS] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── GET /api/external/orders?order_id=xxx ──
export async function GET(request) {
  const keyRecord = await validateApiKey(request);
  if (!keyRecord) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const externalOrderId = searchParams.get('order_id');
  const jobId = searchParams.get('job_id');

  let query = supabaseAdmin
    .from('express_jobs')
    .select('id, job_number, status, external_order_id, pickup_address, delivery_address, assigned_driver_id, created_at, updated_at')
    .eq('external_source', keyRecord.source);

  if (jobId) {
    query = query.eq('id', jobId);
  } else if (externalOrderId) {
    query = query.eq('external_order_id', externalOrderId);
  } else {
    return NextResponse.json({ error: 'Provide job_id or order_id' }, { status: 400 });
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  return NextResponse.json({
    job_id: data.id,
    job_number: data.job_number,
    status: data.status,
    external_order_id: data.external_order_id,
    tracking_url: `https://app.techchainglobal.com/track/${data.id}`,
    created_at: data.created_at,
    updated_at: data.updated_at,
  });
}

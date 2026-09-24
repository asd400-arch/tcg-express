// Outbound status callback to the partner that created a job through /api/external/*.
// Called after a successful status update. Never throws — logs and gives up after 3 tries.
import { supabaseAdmin } from './supabase-server';

const STATUS_MAP = {
  assigned: 'assigned',
  pickup_confirmed: 'picked_up',
  picked_up: 'picked_up',
  in_transit: 'picked_up',
  delivered: 'delivered',
  confirmed: 'delivered',
  completed: 'delivered',
  cancelled: 'failed',
};

export async function notifyPartner(job) {
  try {
    if (!job?.external_api_key_id) return;
    const mapped = STATUS_MAP[job.status];
    if (!mapped) return;

    const { data: key } = await supabaseAdmin
      .from('external_api_keys')
      .select('webhook_url, webhook_secret, source')
      .eq('id', job.external_api_key_id)
      .single();
    if (!key?.webhook_url) return;

    const payload = {
      job_id: job.id,
      job_number: job.job_number,
      route_id: job.partner_route_id || null,
      external_ref: job.external_order_id,
      status: mapped,
      raw_status: job.status,
      driver_id: job.assigned_driver_id || null,
      photo_url: job.delivery_photo || job.pickup_photo || null,
      signature_url: job.customer_signature_url || null,
      at: new Date().toISOString(),
    };

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(key.webhook_url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-express-secret': key.webhook_secret || '' },
          body: JSON.stringify(payload),
        });
        if (res.ok) return;
        console.error(`[PARTNER-WEBHOOK] ${key.source} ${res.status} attempt ${attempt}`);
      } catch (e) {
        console.error(`[PARTNER-WEBHOOK] ${key.source} attempt ${attempt}:`, e?.message);
      }
      await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  } catch (e) {
    console.error('[PARTNER-WEBHOOK] unexpected:', e?.message);
  }
}

// When a stop finishes, roll the route status forward.
export async function refreshRouteStatus(routeId) {
  try {
    if (!routeId) return;
    const { data: stops } = await supabaseAdmin
      .from('express_jobs').select('status').eq('partner_route_id', routeId);
    if (!stops?.length) return;
    const done = stops.every(s => ['delivered', 'confirmed', 'completed', 'cancelled'].includes(s.status));
    const started = stops.some(s => !['assigned', 'open'].includes(s.status));
    const status = done ? 'completed' : started ? 'in_progress' : 'assigned';
    await supabaseAdmin.from('partner_routes')
      .update({ status, updated_at: new Date().toISOString() }).eq('id', routeId);
  } catch (e) {
    console.error('[PARTNER-ROUTE] refresh:', e?.message);
  }
}

// Pickup / delivery geofence (11 Oct 2026).
// When a driver confirms pickup or delivery, check they are near the job's pin.
// Mode (express_settings key 'geofence_mode'):
//   'log'   (default) — never blocks; a far-away or location-less confirmation is flagged to the admins
//   'block' — a confirmation too far from the pin is refused; the driver must move closer
//             (or an admin updates the status from the admin panel, which skips the check)
//   'off'   — no check
import { supabaseAdmin } from './supabase-server';

export const GEOFENCE_RADIUS_M = 300;        // base radius around the pin
export const GEOFENCE_MAX_ACCURACY_SLACK_M = 200; // extra allowance for a poor GPS fix (car parks, towers)
export const GEOFENCE_FIX_MAX_AGE_MIN = 5;   // fallback live-location point must be this fresh

export function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

export async function getGeofenceMode() {
  try {
    const { data } = await supabaseAdmin.from('express_settings').select('value').eq('key', 'geofence_mode').maybeSingle();
    const v = String(data?.value || '').replace(/"/g, '').trim().toLowerCase();
    if (['log', 'block', 'off'].includes(v)) return v;
  } catch { /* table/key missing → default */ }
  return 'log';
}

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {object} job   express_jobs row
 * @param {'pickup'|'delivery'} stage
 * @param {object} body  request body (lat/lng/accuracy or latitude/longitude/accuracy)
 * @param {string} driverId
 * @returns {Promise<{checked:boolean, ok:boolean, reason?:string, distance_m?:number, allowed_m?:number, accuracy_m?:number|null, source?:string}>}
 */
export async function checkStopLocation(job, stage, body, driverId) {
  const pinLat = num(stage === 'pickup' ? job.pickup_lat : job.delivery_lat);
  const pinLng = num(stage === 'pickup' ? job.pickup_lng : job.delivery_lng);
  if (pinLat == null || pinLng == null) return { checked: false, ok: true, reason: 'no_pin' };

  let lat = num(body?.lat ?? body?.latitude);
  let lng = num(body?.lng ?? body?.longitude);
  let accuracy = num(body?.accuracy);
  let source = 'device';

  if (lat == null || lng == null) {
    // Older app builds don't send a fix: fall back to the live-location stream for this job
    try {
      const { data: loc } = await supabaseAdmin
        .from('express_driver_locations')
        .select('latitude, longitude, accuracy, updated_at, driver_id')
        .eq('job_id', job.id)
        .maybeSingle();
      const fresh = loc?.updated_at && Date.now() - new Date(loc.updated_at).getTime() <= GEOFENCE_FIX_MAX_AGE_MIN * 60000;
      if (loc && fresh && (!driverId || loc.driver_id === driverId)) {
        lat = num(loc.latitude); lng = num(loc.longitude); accuracy = num(loc.accuracy); source = 'live';
      }
    } catch { /* ignore */ }
  }
  if (lat == null || lng == null) return { checked: true, ok: false, reason: 'no_location' };

  const distance = distanceMeters(lat, lng, pinLat, pinLng);
  const slack = accuracy != null && accuracy > 0 ? Math.min(accuracy, GEOFENCE_MAX_ACCURACY_SLACK_M) : 0;
  const allowed = GEOFENCE_RADIUS_M + Math.round(slack);
  return {
    checked: true,
    ok: distance <= allowed,
    reason: distance <= allowed ? 'inside' : 'too_far',
    distance_m: distance,
    allowed_m: allowed,
    accuracy_m: accuracy,
    source,
  };
}

export function formatDistance(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

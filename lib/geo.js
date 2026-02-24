/**
 * Geo-fencing utilities for service zone checks.
 * Zones use bounding-box format: lat_min, lat_max, lng_min, lng_max
 * Zone types: 'coverage' (normal), 'surcharge' (extra fee), 'restricted' (blocked)
 */

/**
 * Returns all active zones containing the given point (bounding box check).
 */
export function findMatchingZones(lat, lng, zones) {
  if (!lat || !lng || !zones) return [];
  const la = parseFloat(lat);
  const lo = parseFloat(lng);
  if (isNaN(la) || isNaN(lo)) return [];
  return zones.filter(z =>
    z.is_active !== false &&
    la >= parseFloat(z.lat_min) && la <= parseFloat(z.lat_max) &&
    lo >= parseFloat(z.lng_min) && lo <= parseFloat(z.lng_max)
  );
}

/**
 * Calculate total surcharge from matching zones.
 * Sums surcharge_flat + surcharge_rate * baseFare for all surcharge zones.
 */
export function calculateZoneSurcharge(baseFare, zones) {
  if (!zones || zones.length === 0) return 0;
  let total = 0;
  for (const z of zones) {
    const flat = parseFloat(z.surcharge_flat) || 0;
    const rate = parseFloat(z.surcharge_rate) || 0;
    total += flat + (rate * baseFare);
  }
  return parseFloat(total.toFixed(2));
}

/**
 * Returns true if the point falls in any restricted zone.
 */
export function isInRestrictedZone(lat, lng, zones) {
  const matching = findMatchingZones(lat, lng, zones);
  return matching.some(z => z.zone_type === 'restricted');
}

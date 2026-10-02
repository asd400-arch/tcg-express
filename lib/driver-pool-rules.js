// Pure driver-pool rules — safe in the browser and on the server (2 Oct 2026). See lib/driver-pool.js.

export const DRIVER_POOLS = ['open', 'tcg', 'direct'];
export const POOL_LABELS = {
  open: 'Any available driver',
  tcg: 'TCG Express fleet',
  direct: 'Specific driver',
};

/** Normalised pool of a job row ('open' when the columns don't exist yet). */
export function jobPool(job) {
  if (job?.target_driver_id) return 'direct';
  return job?.driver_pool === 'tcg' ? 'tcg' : 'open';
}

/**
 * Can this driver see / take this job?
 * driver: { id, tcg_fleet } — tcg_fleet undefined (no column yet) counts as false.
 */
export function driverCanTakeJob(job, driver) {
  if (!job || !driver) return false;
  const pool = jobPool(job);
  if (pool === 'direct') return job.target_driver_id === driver.id;
  if (pool === 'tcg') return driver.tcg_fleet === true;
  return true;
}

/** Why not, in words a driver understands. */
export function poolBlockMessage(job) {
  const pool = jobPool(job);
  if (pool === 'direct') return 'This job was booked for a specific driver.';
  if (pool === 'tcg') return 'This job is for TCG Express fleet drivers only.';
  return 'You cannot take this job.';
}

/** Driver codes look like "D7K3Q" — letters and digits, no 0/O/1/I confusion. */
export function normaliseDriverCode(raw) {
  return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Short public label for a driver ("Ahmad S."). */
export function driverShortName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Driver';
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/**
 * Contract trips (2 Oct 2026): a trip is several jobs sharing consolidation_group_id. On a job board,
 * show one card per trip (the lowest open drop) with _trip_drops = how many drops it carries.
 */
export function collapseTrips(jobs) {
  const out = [];
  const seen = new Map();
  for (const j of jobs || []) {
    const g = j?.billing_mode === 'invoice' ? j.consolidation_group_id : null;
    if (!g) { out.push(j); continue; }
    const cur = seen.get(g);
    if (!cur) { const c = { ...j, _trip_drops: 1 }; seen.set(g, c); out.push(c); continue; }
    cur._trip_drops += 1;
    if ((j.trip_seq || 0) < (cur.trip_seq || 0)) {
      Object.assign(cur, { ...j, _trip_drops: cur._trip_drops });
    }
  }
  return out;
}

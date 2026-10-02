import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { resolveDriverCode, driverShortName } from '../../../../lib/driver-pool';
import { getVehicleLabel } from '../../../../lib/job-helpers';
import { rateLimiters, applyRateLimit } from '../../../../lib/rate-limiters';

// GET /api/drivers/lookup?code=ABC12 — customers check a driver code before booking (2 Oct 2026).
// Returns only a short name and vehicle, never contact details.
export async function GET(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['client', 'admin'].includes(session.role)) return NextResponse.json({ error: 'Customers only' }, { status: 403 });
    const blocked = applyRateLimit(rateLimiters.general, `driver-lookup:${session.userId}`);
    if (blocked) return blocked;

    const code = new URL(request.url).searchParams.get('code');
    const r = await resolveDriverCode(code);
    if (r.error) return NextResponse.json({ error: r.error }, { status: r.status || 400 });
    const vehicle = getVehicleLabel(r.driver.vehicle_type) || r.driver.vehicle_type || null;
    return NextResponse.json({ data: { code: r.driver.driver_code, name: driverShortName(r.driver.contact_name), vehicle, vehicle_type: r.driver.vehicle_type } });
  } catch (err) {
    console.error('GET /api/drivers/lookup error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

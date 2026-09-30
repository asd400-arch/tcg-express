import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { role } = await request.json();

    const BASE_COLUMNS = 'id, email, role, contact_name, phone, company_name, vehicle_type, vehicle_plate, license_number, driver_status, driver_rating, total_deliveries, is_active, is_verified, created_at, driver_type, nric_number, business_reg_number, nric_front_url, nric_back_url, license_photo_url, business_reg_cert_url, vehicle_insurance_url';
    // Cross-border (Malaysia) verification columns — 30 Sep 2026 migration; fall back if not run yet
    const XB_COLUMNS = ', cross_border_requested, cross_border_requested_at, cross_border_ready, cross_border_verified_at, cross_border_notes';
    const run = async (columns) => {
      let query = supabaseAdmin.from('express_users').select(columns).order('created_at', { ascending: false });
      if (role) query = query.eq('role', role);
      return query;
    };

    let { data, error } = await run(BASE_COLUMNS + XB_COLUMNS);
    if (error && (error.code === '42703' || /column .* does not exist/i.test(error.message || ''))) {
      ({ data, error } = await run(BASE_COLUMNS));
    }
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

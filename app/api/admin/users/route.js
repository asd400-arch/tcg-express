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

    let query = supabaseAdmin
      .from('express_users')
      .select('id, email, role, contact_name, phone, company_name, vehicle_type, vehicle_plate, license_number, driver_status, driver_rating, total_deliveries, is_active, is_verified, created_at, driver_type, nric_number, business_reg_number, nric_front_url, nric_back_url, license_photo_url, business_reg_cert_url, vehicle_insurance_url')
      .order('created_at', { ascending: false });

    if (role) {
      query = query.eq('role', role);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

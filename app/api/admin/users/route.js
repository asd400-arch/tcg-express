import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';

export async function POST(request) {
  try {
    const { adminId, role } = await request.json();

    // Verify admin
    const { data: admin } = await supabaseAdmin
      .from('express_users')
      .select('id, role')
      .eq('id', adminId)
      .single();

    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let query = supabaseAdmin
      .from('express_users')
      .select('id, email, role, contact_name, phone, company_name, vehicle_type, vehicle_plate, license_number, driver_status, driver_rating, total_deliveries, is_active, is_verified, created_at')
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

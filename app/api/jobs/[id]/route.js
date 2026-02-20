import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

export async function GET(request, { params }) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('express_jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  // Clients can only see their own jobs, drivers can see assigned or open jobs
  if (session.role === 'client' && data.client_id !== session.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch driver info if assigned
  if (data.assigned_driver_id) {
    const { data: driver } = await supabaseAdmin
      .from('express_users')
      .select('contact_name, phone, vehicle_type, vehicle_plate, driver_rating')
      .eq('id', data.assigned_driver_id)
      .single();
    if (driver) {
      data.driver_name = driver.contact_name;
      data.driver_phone = driver.phone;
      data.vehicle_type = driver.vehicle_type;
      data.vehicle_plate = driver.vehicle_plate;
      data.driver_rating = driver.driver_rating;
    }
  }

  // Fetch client info for drivers
  if (session.role === 'driver' && data.client_id) {
    const { data: client } = await supabaseAdmin
      .from('express_users')
      .select('contact_name, phone, company_name, client_rating')
      .eq('id', data.client_id)
      .single();
    if (client) {
      data.client_name = client.contact_name;
      data.client_phone = client.phone;
      data.client_company = client.company_name;
      data.client_rating = client.client_rating;
    }
  }

  return NextResponse.json({ data });
}

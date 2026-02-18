import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';

export async function POST(request) {
  try {
    const { driverId } = await request.json();
    if (!driverId) {
      return NextResponse.json({ error: 'Missing driverId' }, { status: 400 });
    }

    const { data: reviews } = await supabaseAdmin
      .from('express_reviews')
      .select('rating')
      .eq('driver_id', driverId);

    const count = reviews?.length || 0;
    const avg = count > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / count : 5.0;

    await supabaseAdmin
      .from('express_users')
      .update({ driver_rating: parseFloat(avg.toFixed(2)), total_deliveries: count })
      .eq('id', driverId);

    return NextResponse.json({ success: true, rating: avg, total: count });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

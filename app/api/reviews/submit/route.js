import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { driverId, clientId, reviewerRole = 'client' } = await request.json();

    if (reviewerRole === 'client') {
      // Client rated driver — recalculate driver_rating + total_deliveries
      if (!driverId) {
        return NextResponse.json({ error: 'Missing driverId' }, { status: 400 });
      }
      const { data: reviews } = await supabaseAdmin
        .from('express_reviews')
        .select('rating')
        .eq('driver_id', driverId)
        .eq('reviewer_role', 'client');

      const count = reviews?.length || 0;
      const avg = count > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / count : 5.0;

      await supabaseAdmin
        .from('express_users')
        .update({ driver_rating: parseFloat(avg.toFixed(2)), total_deliveries: count })
        .eq('id', driverId);

      return NextResponse.json({ success: true, rating: avg, total: count });
    }

    if (reviewerRole === 'driver') {
      // Driver rated client — recalculate client_rating
      if (!clientId) {
        return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
      }
      const { data: reviews } = await supabaseAdmin
        .from('express_reviews')
        .select('rating')
        .eq('client_id', clientId)
        .eq('reviewer_role', 'driver');

      const count = reviews?.length || 0;
      const avg = count > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / count : 5.0;

      await supabaseAdmin
        .from('express_users')
        .update({ client_rating: parseFloat(avg.toFixed(2)) })
        .eq('id', clientId);

      return NextResponse.json({ success: true, rating: avg, total: count });
    }

    return NextResponse.json({ error: 'Invalid reviewerRole' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

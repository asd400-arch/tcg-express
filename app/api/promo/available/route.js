import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

export async function GET(request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: promos, error } = await supabaseAdmin
      .from('promo_codes')
      .select('id, code, description, discount_type, discount_value, max_discount, min_order_amount, valid_from, valid_until, new_customers_only, per_user_limit')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const now = new Date();
    const available = [];
    for (const promo of promos || []) {
      if (promo.valid_until && new Date(promo.valid_until) < now) continue;
      if (promo.valid_from && new Date(promo.valid_from) > now) continue;
      if (promo.new_customers_only) {
        const { count } = await supabaseAdmin
          .from('express_jobs')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', session.userId)
          .not('status', 'eq', 'cancelled');
        if ((count ?? 0) > 0) continue;
      }
      let usedCount = 0;
      if (promo.per_user_limit) {
        const { count } = await supabaseAdmin
          .from('express_jobs')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', session.userId)
          .eq('coupon_id', promo.id)
          .not('status', 'eq', 'cancelled');
        usedCount = count ?? 0;
        if (usedCount >= promo.per_user_limit) continue;
      }
      available.push({
        ...promo,
        remaining_uses: promo.per_user_limit ? promo.per_user_limit - usedCount : null,
      });
    }

    return NextResponse.json({ data: available });
  } catch (err) {
    console.error('GET /api/promo/available error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

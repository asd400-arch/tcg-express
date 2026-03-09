import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { code, orderAmount } = await request.json();
    if (!code) return NextResponse.json({ error: 'Coupon code required' }, { status: 400 });

    // Fetch coupon using service role (bypasses RLS)
    const { data: promo } = await supabaseAdmin
      .from('promo_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (!promo || !promo.is_active) {
      return NextResponse.json({ error: 'Invalid voucher code' }, { status: 404 });
    }

    const now = new Date();
    if (promo.valid_until && new Date(promo.valid_until) < now) {
      return NextResponse.json({ error: 'Voucher has expired' }, { status: 400 });
    }
    if (promo.valid_from && new Date(promo.valid_from) > now) {
      return NextResponse.json({ error: 'Voucher is not yet active' }, { status: 400 });
    }
    if (promo.usage_limit && promo.usage_count >= promo.usage_limit) {
      return NextResponse.json({ error: 'Voucher usage limit reached' }, { status: 400 });
    }

    // Per-user usage check
    if (promo.per_user_limit) {
      const { count } = await supabaseAdmin
        .from('express_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('coupon_id', promo.id)
        .eq('client_id', session.userId);

      if (count >= promo.per_user_limit) {
        return NextResponse.json({ error: `You have already used this voucher${promo.per_user_limit > 1 ? ` ${promo.per_user_limit} times` : ''}` }, { status: 400 });
      }
    }

    // New customers only check
    if (promo.new_customers_only) {
      const { count } = await supabaseAdmin
        .from('express_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', session.userId)
        .not('status', 'eq', 'cancelled');

      if (count > 0) {
        return NextResponse.json({ error: 'This voucher is for new customers only' }, { status: 400 });
      }
    }

    // Min order amount check
    if (promo.min_order_amount && orderAmount && parseFloat(orderAmount) < parseFloat(promo.min_order_amount)) {
      return NextResponse.json({ error: `Minimum order $${promo.min_order_amount} required` }, { status: 400 });
    }

    // Calculate discount
    let discount = 0;
    if (orderAmount) {
      const amt = parseFloat(orderAmount);
      if (promo.discount_type === 'percentage') {
        discount = amt * (parseFloat(promo.discount_value) / 100);
        if (promo.max_discount) discount = Math.min(discount, parseFloat(promo.max_discount));
      } else {
        discount = parseFloat(promo.discount_value);
      }
      discount = Math.min(discount, amt);
    }

    return NextResponse.json({
      valid: true,
      coupon: {
        id: promo.id,
        code: promo.code,
        type: promo.discount_type,
        value: promo.discount_value,
        max_discount: promo.max_discount,
        description: promo.description,
        min_order: promo.min_order_amount,
        new_customers_only: promo.new_customers_only,
      },
      discount: discount.toFixed(2),
    });
  } catch (err) {
    console.error('POST /api/coupons/validate error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

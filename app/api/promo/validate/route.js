import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const code = body.code;
    const orderAmount = parseFloat(body.amount ?? body.orderAmount ?? 0);

    if (!code) return NextResponse.json({ error: 'Promo code required' }, { status: 400 });

    const { data: promo } = await supabaseAdmin
      .from('promo_codes')
      .select('*')
      .eq('code', String(code).toUpperCase().trim())
      .single();

    if (!promo || !promo.is_active) {
      return NextResponse.json({ valid: false, error: 'Invalid promo code' }, { status: 404 });
    }

    const now = new Date();
    if (promo.valid_until && new Date(promo.valid_until) < now) {
      return NextResponse.json({ valid: false, error: 'Promo code has expired' }, { status: 400 });
    }
    if (promo.valid_from && new Date(promo.valid_from) > now) {
      return NextResponse.json({ valid: false, error: 'Promo code is not yet active' }, { status: 400 });
    }
    if (promo.usage_limit && promo.usage_count >= promo.usage_limit) {
      return NextResponse.json({ valid: false, error: 'Promo code usage limit reached' }, { status: 400 });
    }

    if (promo.per_user_limit) {
      const { count } = await supabaseAdmin
        .from('express_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('coupon_id', promo.id)
        .eq('client_id', session.userId);
      if ((count ?? 0) >= promo.per_user_limit) {
        return NextResponse.json({ valid: false, error: 'You have already used this promo code' }, { status: 400 });
      }
    }

    if (promo.new_customers_only) {
      const { count } = await supabaseAdmin
        .from('express_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', session.userId)
        .not('status', 'eq', 'cancelled');
      if ((count ?? 0) > 0) {
        return NextResponse.json({ valid: false, error: 'This promo is for new customers only' }, { status: 400 });
      }
    }

    if (promo.min_order_amount && orderAmount < parseFloat(promo.min_order_amount)) {
      return NextResponse.json({
        valid: false,
        error: `Minimum order S$${parseFloat(promo.min_order_amount).toFixed(2)} required`,
      }, { status: 400 });
    }

    let discount = 0;
    if (orderAmount > 0) {
      if (promo.discount_type === 'percentage') {
        discount = orderAmount * (parseFloat(promo.discount_value) / 100);
        if (promo.max_discount) discount = Math.min(discount, parseFloat(promo.max_discount));
      } else {
        discount = parseFloat(promo.discount_value);
      }
      discount = Math.min(discount, orderAmount);
    }

    return NextResponse.json({
      valid: true,
      data: {
        coupon: {
          id: promo.id,
          code: promo.code,
          type: promo.discount_type,
          value: promo.discount_value,
          max_discount: promo.max_discount,
          description: promo.description,
        },
        discount: discount.toFixed(2),
      },
      coupon: {
        id: promo.id,
        code: promo.code,
        type: promo.discount_type,
        value: promo.discount_value,
        max_discount: promo.max_discount,
      },
      discount: discount.toFixed(2),
    });
  } catch (err) {
    console.error('POST /api/promo/validate error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

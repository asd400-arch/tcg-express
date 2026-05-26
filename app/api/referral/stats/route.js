import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

export async function GET(request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: rewards, error } = await supabaseAdmin
      .from('referral_rewards')
      .select('status, referrer_amount')
      .eq('referrer_id', session.userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const list = rewards || [];
    const completed = list.filter((r) => r.status === 'completed');

    return NextResponse.json({
      data: {
        total: list.length,
        pending: list.filter((r) => r.status === 'pending').length,
        earned: completed.reduce((sum, r) => sum + (parseFloat(r.referrer_amount) || 0), 0),
      },
    });
  } catch (err) {
    console.error('GET /api/referral/stats error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

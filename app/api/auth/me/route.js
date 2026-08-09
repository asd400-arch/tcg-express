import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

export async function GET(request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: user, error } = await supabaseAdmin
      .from('express_users')
      .select('*')
      .eq('id', session.userId)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.is_active) {
      return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
    }

    // Strip password_hash before returning
    const { password_hash, verification_code, verification_code_expires, reset_code, reset_code_expires, ...safeUser } = user;

    // Enrich drivers with first_delivery_at for zero-commission banner
    if (user.role === 'driver') {
      try {
        const { data: firstJob } = await supabaseAdmin
          .from('express_jobs')
          .select('completed_at')
          .eq('assigned_driver_id', session.userId)
          .in('status', ['completed', 'confirmed', 'delivered'])
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        safeUser.first_delivery_at = firstJob?.completed_at || null;
      } catch {
        safeUser.first_delivery_at = null;
      }
    }

    return NextResponse.json({ data: safeUser });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

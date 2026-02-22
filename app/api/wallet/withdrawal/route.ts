import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requestWithdrawal } from '@/lib/walletService';

// POST /api/wallet/withdrawal — request a withdrawal (drivers only)
export async function POST(request: Request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is a driver
    const { data: user } = await supabaseAdmin
      .from('express_users')
      .select('role')
      .eq('id', session.userId)
      .single();

    if (!user || user.role !== 'driver') {
      return NextResponse.json({ error: 'Only drivers can request withdrawals' }, { status: 403 });
    }

    const { amount, method } = await request.json();

    if (!amount || !method) {
      return NextResponse.json({ error: 'Amount and method required' }, { status: 400 });
    }

    const withdrawal = await requestWithdrawal(session.userId, { amount: Number(amount), method });
    return NextResponse.json({ data: withdrawal });
  } catch (err: any) {
    console.error('POST /api/wallet/withdrawal error:', err);
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 400 }
    );
  }
}

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requestWithdrawal, updateWithdrawalSettings } from '@/lib/walletService';

export async function POST(request: Request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: user } = await supabaseAdmin
      .from('express_users')
      .select('role')
      .eq('id', session.userId)
      .single();

    if (!user || user.role !== 'driver') {
      return NextResponse.json({ error: 'Only drivers can request withdrawals' }, { status: 403 });
    }

    const body = await request.json();
    const amount = Number(body.amount);
    const bank_name = body.bank_name?.trim();
    const account_number = (body.account_number ?? body.bank_account_number)?.trim();
    const account_name = (body.account_name ?? body.bank_account_holder)?.trim();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    }
    if (!bank_name || !account_number || !account_name) {
      return NextResponse.json({ error: 'Bank details are required' }, { status: 400 });
    }

    await updateWithdrawalSettings(session.userId, {
      bank_name,
      bank_account_number: account_number,
      bank_account_holder: account_name,
    });

    const withdrawal = await requestWithdrawal(session.userId, {
      amount,
      method: 'bank_transfer',
      bank_name,
      bank_account_number: account_number,
      bank_account_holder: account_name,
    });

    return NextResponse.json({ data: withdrawal });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    console.error('POST /api/wallet/withdraw error:', err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

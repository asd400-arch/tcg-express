import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { getSession } from '../../../lib/auth';

// GET wallet balance + recent transactions
export async function GET(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get or create wallet
  let { data: wallet } = await supabaseAdmin
    .from('express_wallets')
    .select('*')
    .eq('user_id', session.userId)
    .single();

  if (!wallet) {
    const { data: newWallet } = await supabaseAdmin
      .from('express_wallets')
      .insert([{ user_id: session.userId }])
      .select()
      .single();
    wallet = newWallet;
  }

  // Get recent transactions
  const { data: transactions } = await supabaseAdmin
    .from('express_wallet_transactions')
    .select('*')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ wallet, transactions: transactions || [] });
}

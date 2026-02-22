import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { confirmPayNowTopup, approveWithdrawal, rejectWithdrawal } from '@/lib/walletService';

// GET /api/admin/wallet — list pending withdrawals or topups
export async function GET(request: Request) {
  try {
    const session = getSession(request);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'withdrawals';
    const status = searchParams.get('status') || 'pending';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    if (type === 'topups') {
      const { data, error, count } = await supabaseAdmin
        .from('wallet_topups')
        .select('*, user:user_id(id, email, contact_name, phone)', { count: 'exact' })
        .eq('status', status)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return NextResponse.json({ data, total: count });
    }

    // Default: withdrawals
    const { data, error, count } = await supabaseAdmin
      .from('wallet_withdrawals')
      .select('*, user:user_id(id, email, contact_name, phone)', { count: 'exact' })
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return NextResponse.json({ data, total: count });
  } catch (err) {
    console.error('GET /api/admin/wallet error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/admin/wallet — handle admin actions
export async function POST(request: Request) {
  try {
    const session = getSession(request);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { action, ...params } = await request.json();

    switch (action) {
      case 'confirm_topup': {
        if (!params.paynow_reference) {
          return NextResponse.json({ error: 'PayNow reference required' }, { status: 400 });
        }
        const topup = await confirmPayNowTopup(params.paynow_reference, session.userId);
        return NextResponse.json({ data: topup });
      }

      case 'approve_withdrawal': {
        if (!params.withdrawal_id) {
          return NextResponse.json({ error: 'Withdrawal ID required' }, { status: 400 });
        }
        const withdrawal = await approveWithdrawal(
          params.withdrawal_id,
          session.userId,
          params.transfer_reference
        );
        return NextResponse.json({ data: withdrawal });
      }

      case 'reject_withdrawal': {
        if (!params.withdrawal_id) {
          return NextResponse.json({ error: 'Withdrawal ID required' }, { status: 400 });
        }
        if (!params.reason) {
          return NextResponse.json({ error: 'Rejection reason required' }, { status: 400 });
        }
        const rejected = await rejectWithdrawal(
          params.withdrawal_id,
          session.userId,
          params.reason
        );
        return NextResponse.json({ data: rejected });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('POST /api/admin/wallet error:', err);
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 400 }
    );
  }
}

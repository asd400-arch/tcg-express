import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getWalletOverview, getTransactionHistory, updateWithdrawalSettings } from '@/lib/walletService';

// GET /api/wallet — wallet overview or transaction history
export async function GET(request: Request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Paginated transaction history
    if (action === 'transactions') {
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const type = searchParams.get('type') || undefined;

      const result = await getTransactionHistory(session.userId, page, limit, type);
      return NextResponse.json({ data: result });
    }

    // Default: wallet overview
    const overview = await getWalletOverview(session.userId);
    return NextResponse.json({ data: overview });
  } catch (err) {
    console.error('GET /api/wallet error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PATCH /api/wallet — update withdrawal settings
export async function PATCH(request: Request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const wallet = await updateWithdrawalSettings(session.userId, body);
    return NextResponse.json({ data: wallet });
  } catch (err: any) {
    console.error('PATCH /api/wallet error:', err);
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 400 }
    );
  }
}

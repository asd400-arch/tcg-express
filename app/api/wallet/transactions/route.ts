import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getTransactionHistory } from '@/lib/walletService';

export async function GET(request: Request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const type = searchParams.get('type') || undefined;

    const result = await getTransactionHistory(session.userId, page, limit, type);
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error('GET /api/wallet/transactions error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

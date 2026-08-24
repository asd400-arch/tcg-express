import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { claimPayNowTopup } from '@/lib/walletService';

// POST /api/wallet/topup/claim — customer taps "I have paid"
//
// Instant provisional credit for direct-UEN PayNow top-ups up to
// WALLET_CONSTANTS.INSTANT_TOPUP_LIMIT. Verified later against the
// bank's incoming-funds alert; unverified ones surface to admin.
export async function POST(request: Request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { topup_id } = await request.json();
    if (!topup_id) {
      return NextResponse.json({ error: 'topup_id required' }, { status: 400 });
    }

    const result = await claimPayNowTopup(session.userId, topup_id);
    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error('POST /api/wallet/topup/claim error:', err);
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 400 }
    );
  }
}

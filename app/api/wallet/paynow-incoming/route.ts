import { NextResponse } from 'next/server';
import { autoConfirmTopupByAmount } from '@/lib/walletService';

// POST /api/wallet/paynow-incoming — bank-alert auto reconciliation
//
// Called by the bank-alert forwarder (e.g. a Google Apps Script that
// parses the bank's incoming-credit notification emails) whenever the
// company account receives a PayNow credit. Matches the exact amount
// to a single pending top-up (unique-cent amounts guarantee at most
// one match) and credits the wallet with NO admin involvement.
//
// Auth: Authorization: Bearer <PAYNOW_ALERT_SECRET>
//
// Body: { "amount": 50.07, "reference": "FAST/PAYNOW ref (optional)" }
//
// Responses:
//   { matched: true,  topup_id, amount }  — credited
//   { matched: false }                    — no/ambiguous match (admin
//                                           can still confirm manually)
export async function POST(request: Request) {
  try {
    const secret = process.env.PAYNOW_ALERT_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }

    const auth = request.headers.get('authorization') || '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const amount = Number(body?.amount);
    const reference = typeof body?.reference === 'string' ? body.reference.slice(0, 100) : undefined;

    if (!amount || isNaN(amount) || amount <= 0 || amount > 100000) {
      return NextResponse.json({ error: 'Valid amount required' }, { status: 400 });
    }

    const topup = await autoConfirmTopupByAmount(amount, reference);

    if (!topup) {
      // Not an error — could be a non-topup credit (invoice payment etc.)
      // or an ambiguous match left for admin review.
      return NextResponse.json({ matched: false });
    }

    return NextResponse.json({
      matched: true,
      topup_id: topup.id,
      amount: topup.amount,
    });
  } catch (err: any) {
    console.error('POST /api/wallet/paynow-incoming error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createPayNowTopup, createStripeTopup, confirmPayNowTopup } from '@/lib/walletService';
import { WALLET_CONSTANTS } from '@/types/wallet';

// POST /api/wallet/topup — create a new top-up
export async function POST(request: Request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount, payment_method } = await request.json();

    if (!amount || !payment_method) {
      return NextResponse.json({ error: 'Amount and payment method required' }, { status: 400 });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < WALLET_CONSTANTS.MIN_TOPUP || numAmount > WALLET_CONSTANTS.MAX_TOPUP) {
      return NextResponse.json(
        { error: `Amount must be between $${WALLET_CONSTANTS.MIN_TOPUP} and $${WALLET_CONSTANTS.MAX_TOPUP}` },
        { status: 400 }
      );
    }

    let result;
    if (payment_method === 'paynow') {
      result = await createPayNowTopup(session.userId, numAmount);
    } else if (payment_method === 'stripe_card') {
      result = await createStripeTopup(session.userId, numAmount);
    } else {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }

    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error('POST /api/wallet/topup error:', err);
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/wallet/topup — admin confirm PayNow top-up
export async function PATCH(request: Request) {
  try {
    const session = getSession(request);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { paynow_reference } = await request.json();
    if (!paynow_reference) {
      return NextResponse.json({ error: 'PayNow reference required' }, { status: 400 });
    }

    const topup = await confirmPayNowTopup(paynow_reference, session.userId);
    return NextResponse.json({ data: topup });
  } catch (err: any) {
    console.error('PATCH /api/wallet/topup error:', err);
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 400 }
    );
  }
}

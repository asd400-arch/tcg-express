import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getStripe } from '@/lib/stripe';
import {
  createPayNowTopup,
  createStripePayNowTopup,
  createStripeTopup,
  confirmPayNowTopup,
} from '@/lib/walletService';
import { WALLET_CONSTANTS } from '@/types/wallet';

// POST /api/wallet/topup — create a new top-up
//
// PayNow flow:
//   1) If Stripe is configured (STRIPE_SECRET_KEY set) and PayNow is
//      enabled on the Stripe account, an AUTO top-up is created:
//      customer scans a Stripe PayNow QR, and the wallet is credited
//      automatically by the webhook — no admin confirmation.
//   2) If Stripe is unavailable (or PayNow not activated), falls back
//      to the legacy direct-UEN QR that requires admin verification.
export async function POST(request: Request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount, payment_method, paynow_reference } = await request.json();

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
      const autoDisabled = process.env.PAYNOW_AUTO_TOPUP === 'off';
      if (getStripe() && !autoDisabled) {
        try {
          result = await createStripePayNowTopup(session.userId, numAmount);
        } catch (stripeErr: any) {
          // Stripe PayNow unavailable (e.g. payment method not activated
          // on the account) — fall back to the manual direct-UEN flow.
          console.warn('[wallet/topup] Stripe PayNow failed, falling back to manual QR:', stripeErr?.message);
          result = await createPayNowTopup(session.userId, numAmount, paynow_reference);
        }
      } else {
        result = await createPayNowTopup(session.userId, numAmount, paynow_reference);
      }
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

// GET /api/wallet/topup?id=<topup_id> — poll a top-up's status
// Used by the client to detect webhook-driven auto completion.
export async function GET(request: Request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Topup ID required' }, { status: 400 });
    }

    const { data: topup, error } = await supabaseAdmin
      .from('wallet_topups')
      .select('id, status, amount, payment_method, completed_at, expires_at')
      .eq('id', id)
      .eq('user_id', session.userId)
      .single();

    if (error || !topup) {
      return NextResponse.json({ error: 'Top-up not found' }, { status: 404 });
    }

    return NextResponse.json({ data: topup });
  } catch (err: any) {
    console.error('GET /api/wallet/topup error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PATCH /api/wallet/topup — admin confirm PayNow top-up
// (Legacy manual flow only — auto top-ups complete via the Stripe webhook.)
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

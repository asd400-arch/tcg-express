import { NextResponse } from 'next/server';
import { generatePayNowQR } from '@/lib/paynow-qr';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const amountParam = searchParams.get('amount');
    const reference = searchParams.get('reference');

    const amount = Number(amountParam);
    if (!Number.isFinite(amount)) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }
    if (amount < 10 || amount > 1000) {
      return NextResponse.json({ error: 'Amount must be between $10 and $1000' }, { status: 400 });
    }
    if (!reference || !String(reference).trim()) {
      return NextResponse.json({ error: 'Reference is required' }, { status: 400 });
    }

    const qrString = generatePayNowQR(amount, reference);

    return NextResponse.json({
      qrString,
      amount: amount.toFixed(2),
      reference: String(reference).trim().slice(0, 25),
    });
  } catch (err) {
    console.error('GET /api/wallet/paynow-qr error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}


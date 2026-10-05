import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { joinRateCardByCode, billingPeriod } from '../../../../lib/contract';

// POST /api/contract/join { code } — a customer's staff member links their account to the
// company's contract (rate card) with the company code (5 Oct 2026). Several staff can share one code.
export async function POST(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'client') return NextResponse.json({ error: 'Only customer accounts can join a company contract' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const r = await joinRateCardByCode(session.userId, body.code);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  const c = r.card;
  return NextResponse.json({
    data: {
      company_name: c.company_name || null,
      label: c.label,
      first_drop_sgd: Number(c.first_drop_sgd),
      next_drop_sgd: Number(c.next_drop_sgd),
      billing: billingPeriod(c),
    },
  });
}

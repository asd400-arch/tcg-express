import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { getSession } from '../../../lib/auth';

// Green tiers: Bronze(0) → Silver(2000, 1.2x) → Gold(5000, 1.5x) → Platinum(10000, 2x)
const GREEN_TIERS = [
  { key: 'bronze', label: 'Bronze', minPoints: 0, multiplier: 1.0 },
  { key: 'silver', label: 'Silver', minPoints: 2000, multiplier: 1.2 },
  { key: 'gold', label: 'Gold', minPoints: 5000, multiplier: 1.5 },
  { key: 'platinum', label: 'Platinum', minPoints: 10000, multiplier: 2.0 },
];

const REDEMPTION_RATE = 100; // 100 points = $1
const MIN_REDEMPTION = 500;  // minimum 500 points ($5)

function getTier(totalPoints) {
  for (let i = GREEN_TIERS.length - 1; i >= 0; i--) {
    if (totalPoints >= GREEN_TIERS[i].minPoints) return GREEN_TIERS[i];
  }
  return GREEN_TIERS[0];
}

export async function GET(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get ledger entries
  const { data: ledger, error: ledgerErr } = await supabaseAdmin
    .from('green_points_ledger')
    .select('*')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false });

  if (ledgerErr) return NextResponse.json({ error: ledgerErr.message }, { status: 500 });

  // Get redemptions
  const { data: redemptions } = await supabaseAdmin
    .from('green_points_redemption')
    .select('*')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false });

  // Calculate totals
  const totalEarned = (ledger || []).reduce((sum, e) => sum + (e.points_earned || 0), 0);
  const totalRedeemed = (redemptions || []).filter(r => r.status !== 'rejected')
    .reduce((sum, r) => sum + (r.points_redeemed || 0), 0);
  const balance = totalEarned - totalRedeemed;
  const totalCo2 = (ledger || []).reduce((sum, e) => sum + (parseFloat(e.co2_saved_kg) || 0), 0);
  const treesEquivalent = parseFloat((totalCo2 / 21.77).toFixed(1)); // 1 tree absorbs ~21.77 kg CO2/year

  const tier = getTier(totalEarned);
  const nextTier = GREEN_TIERS.find(t => t.minPoints > totalEarned) || null;

  return NextResponse.json({
    data: {
      balance,
      totalEarned,
      totalRedeemed,
      totalCo2,
      treesEquivalent,
      tier: tier.key,
      tierLabel: tier.label,
      tierMultiplier: tier.multiplier,
      nextTier: nextTier ? { key: nextTier.key, label: nextTier.label, pointsNeeded: nextTier.minPoints - totalEarned } : null,
      canRedeem: balance >= MIN_REDEMPTION,
      cashbackAvailable: parseFloat((balance / REDEMPTION_RATE).toFixed(2)),
      recentHistory: (ledger || []).slice(0, 20),
      redemptions: redemptions || [],
    },
  });
}

export async function POST(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { action, points, payment_method } = body;

  if (action === 'redeem') {
    if (!points || points < MIN_REDEMPTION) {
      return NextResponse.json({ error: `Minimum ${MIN_REDEMPTION} points required` }, { status: 400 });
    }

    // Check balance
    const { data: ledger } = await supabaseAdmin
      .from('green_points_ledger')
      .select('points_earned')
      .eq('user_id', session.userId);

    const { data: redemptions } = await supabaseAdmin
      .from('green_points_redemption')
      .select('points_redeemed')
      .eq('user_id', session.userId)
      .neq('status', 'rejected');

    const totalEarned = (ledger || []).reduce((sum, e) => sum + (e.points_earned || 0), 0);
    const totalRedeemed = (redemptions || []).reduce((sum, r) => sum + (r.points_redeemed || 0), 0);
    const balance = totalEarned - totalRedeemed;

    if (points > balance) {
      return NextResponse.json({ error: 'Insufficient points' }, { status: 400 });
    }

    const cashback = parseFloat((points / REDEMPTION_RATE).toFixed(2));

    const { data, error } = await supabaseAdmin
      .from('green_points_redemption')
      .insert([{
        user_id: session.userId,
        points_redeemed: points,
        cashback_amount: cashback,
        payment_method: payment_method || 'wallet',
        status: 'pending',
      }])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

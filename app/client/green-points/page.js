'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import useMobile from '../../components/useMobile';

const TIERS = [
  { name: 'Bronze', min: 0, color: '#92400e', bg: '#fef3c7', icon: '🥉' },
  { name: 'Silver', min: 2000, color: '#64748b', bg: '#f1f5f9', icon: '🥈' },
  { name: 'Gold', min: 5000, color: '#b45309', bg: '#fef9c3', icon: '🥇' },
  { name: 'Platinum', min: 10000, color: '#7c3aed', bg: '#f5f3ff', icon: '💎' },
];

export default function GreenPointsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const m = useMobile();
  const [data, setData] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'client') router.push('/');
    if (user) loadData();
  }, [user, loading]);

  const loadData = async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/green-points');
      const json = await res.json();
      setData(json.data || json);
    } catch { /* ignore */ }
    setFetching(false);
  };

  const handleRedeem = async () => {
    const pts = parseInt(redeemAmount);
    if (!pts || pts < 100) { toast.error('Minimum 100 points to redeem'); return; }
    if (pts > (data?.balance || 0)) { toast.error('Insufficient points'); return; }
    setRedeeming(true);
    try {
      const res = await fetch('/api/green-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'redeem', points: pts }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Redemption failed'); setRedeeming(false); return; }
      toast.success(`Redeemed ${pts} points for $${(pts / 100).toFixed(2)}`);
      setRedeemAmount('');
      loadData();
    } catch { toast.error('Redemption failed'); }
    setRedeeming(false);
  };

  if (loading || !user) return <Spinner />;

  const card = { background: 'white', borderRadius: '14px', padding: m ? '20px' : '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '20px' };
  const balance = data?.balance || 0;
  const tier = data?.tierLabel || data?.tier || 'Bronze';
  const tierInfo = TIERS.find(t => t.name === tier || t.name.toLowerCase() === tier) || TIERS[0];
  const nextTier = TIERS[TIERS.indexOf(tierInfo) + 1];
  const progress = nextTier ? Math.min(100, ((balance - tierInfo.min) / (nextTier.min - tierInfo.min)) * 100) : 100;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Green Points" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', maxWidth: '720px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>Green Points</h1>

        {fetching ? <Spinner /> : (
          <>
            {/* Balance & Tier */}
            <div style={{ ...card, background: `linear-gradient(135deg, ${tierInfo.bg}, white)`, border: `2px solid ${tierInfo.color}30` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Your Balance</div>
                  <div style={{ fontSize: '36px', fontWeight: '800', color: '#16a34a' }}>{balance.toLocaleString()}</div>
                  <div style={{ fontSize: '14px', color: '#64748b' }}>= ${(balance / 100).toFixed(2)} cashback value</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '40px' }}>{tierInfo.icon}</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: tierInfo.color }}>{tier}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{data?.tierMultiplier || '1.0'}x multiplier</div>
                </div>
              </div>
              {nextTier && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                    <span>{tier}</span>
                    <span>{nextTier.name} ({nextTier.min.toLocaleString()} pts)</span>
                  </div>
                  <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, #16a34a, #22c55e)`, borderRadius: '4px', transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{(nextTier.min - balance).toLocaleString()} points to {nextTier.name}</div>
                </div>
              )}
            </div>

            {/* CO2 Impact */}
            <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
              {[
                { label: 'CO2 Saved', value: `${(data?.totalCo2 || 0).toFixed(1)}kg`, icon: '🌍', color: '#16a34a' },
                { label: 'Trees Equivalent', value: (data?.treesEquivalent || 0).toFixed(1), icon: '🌳', color: '#15803d' },
                { label: 'Total Earned', value: (data?.totalEarned || 0).toLocaleString(), icon: '⚡', color: '#0ea5e9' },
              ].map((s, i) => (
                <div key={i} style={{ ...card, textAlign: 'center', marginBottom: 0 }}>
                  <div style={{ fontSize: '24px', marginBottom: '6px' }}>{s.icon}</div>
                  <div style={{ fontSize: '22px', fontWeight: '700', color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Redeem */}
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>Redeem Points</h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>100 points = $1.00 wallet credit. Minimum 100 points.</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="number" min="100" step="100" value={redeemAmount} onChange={e => setRedeemAmount(e.target.value)}
                  placeholder="Points to redeem" style={{ flex: 1, padding: '12px 16px', borderRadius: '10px', fontSize: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', fontFamily: "'Inter', sans-serif" }} />
                <button onClick={handleRedeem} disabled={redeeming} style={{
                  padding: '12px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #16a34a, #15803d)',
                  color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", opacity: redeeming ? 0.7 : 1,
                }}>{redeeming ? 'Redeeming...' : 'Redeem'}</button>
              </div>
              {redeemAmount && parseInt(redeemAmount) >= 100 && (
                <div style={{ marginTop: '8px', fontSize: '13px', color: '#16a34a', fontWeight: '500' }}>
                  = ${(parseInt(redeemAmount) / 100).toFixed(2)} wallet credit
                </div>
              )}
            </div>

            {/* History */}
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>Points History</h3>
              {(!data?.recentHistory || data.recentHistory.length === 0) ? (
                <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '20px' }}>No points earned yet. Choose EV delivery or SaveMode to earn Green Points!</p>
              ) : (
                data.recentHistory.map((entry, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < data.recentHistory.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>{entry.points_type?.replace(/_/g, ' ') || 'Earned'}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(entry.created_at).toLocaleDateString()}{entry.co2_saved_kg ? ` | ${entry.co2_saved_kg}kg CO2` : ''}</div>
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#16a34a' }}>
                      +{entry.points_earned}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

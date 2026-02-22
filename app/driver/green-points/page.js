'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import useMobile from '../../components/useMobile';

const TIERS = [
  { name: 'Bronze', min: 0, color: '#92400e', bg: '#fef3c7', icon: '🥉' },
  { name: 'Silver', min: 2000, color: '#64748b', bg: '#f1f5f9', icon: '🥈' },
  { name: 'Gold', min: 5000, color: '#b45309', bg: '#fef9c3', icon: '🥇' },
  { name: 'Platinum', min: 10000, color: '#7c3aed', bg: '#f5f3ff', icon: '💎' },
];

export default function DriverGreenPointsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const m = useMobile();
  const [data, setData] = useState(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'driver') router.push('/');
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
                  <div style={{ fontSize: '14px', color: '#64748b' }}>{data?.tierMultiplier || '1.0'}x earning multiplier</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '40px' }}>{tierInfo.icon}</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: tierInfo.color }}>{tier}</div>
                </div>
              </div>
              {nextTier && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                    <span>{tier}</span>
                    <span>{nextTier.name} ({nextTier.min.toLocaleString()} pts)</span>
                  </div>
                  <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, #16a34a, #22c55e)`, borderRadius: '4px' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Impact Stats */}
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

            {/* EV Driver Benefits */}
            <div style={{ ...card, border: '2px solid #16a34a20', background: '#f0fdf4' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#15803d', marginBottom: '12px' }}>EV Driver Benefits</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { label: 'Lower commission rate', desc: '10% vs 15% standard', icon: '💰' },
                  { label: 'Priority matching', desc: 'Get matched first for EV-preferred jobs', icon: '⚡' },
                  { label: 'Bonus Green Points', desc: 'Earn extra points on every EV delivery', icon: '🌱' },
                ].map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'white', borderRadius: '10px' }}>
                    <span style={{ fontSize: '20px' }}>{b.icon}</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{b.label}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{b.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Points History */}
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>Points History</h3>
              {(!data?.recentHistory || data.recentHistory.length === 0) ? (
                <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '20px' }}>No points earned yet. Complete EV deliveries to earn Green Points!</p>
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

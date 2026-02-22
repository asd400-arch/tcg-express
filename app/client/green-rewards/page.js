'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import useMobile from '../../components/useMobile';

const REWARDS = [
  { id: 'wallet_50', name: '$0.50 Wallet Credit', points: 50, icon: '💰', desc: 'Credited to your wallet instantly' },
  { id: 'wallet_200', name: '$2.00 Wallet Credit', points: 200, icon: '💰', desc: 'Credited to your wallet instantly' },
  { id: 'wallet_500', name: '$5.00 Wallet Credit', points: 500, icon: '💰', desc: 'Credited to your wallet instantly' },
  { id: 'free_delivery', name: 'Free Motorcycle Delivery', points: 800, icon: '🏍️', desc: 'One free motorcycle delivery (up to $15)' },
  { id: 'ev_bonus', name: 'Double EV Points (1 week)', points: 1000, icon: '⚡', desc: 'Earn 2x Green Points on EV deliveries for 7 days' },
  { id: 'priority_booking', name: 'Priority Booking (1 month)', points: 2000, icon: '🚀', desc: 'Jobs matched to drivers faster for 30 days' },
  { id: 'carbon_cert', name: 'Carbon Offset Certificate', points: 5000, icon: '🌍', desc: 'Verified carbon offset certificate for your company' },
  { id: 'tree_plant', name: 'Plant a Tree', points: 500, icon: '🌳', desc: 'We plant a tree on your behalf via OneTreePlanted' },
];

const TIERS = [
  { name: 'Bronze', min: 0, perks: ['1x earning rate', 'Standard rewards'], color: '#92400e', icon: '🥉' },
  { name: 'Silver', min: 2000, perks: ['1.2x earning rate', 'All rewards unlocked', 'Monthly bonus points'], color: '#64748b', icon: '🥈' },
  { name: 'Gold', min: 5000, perks: ['1.5x earning rate', 'Exclusive rewards', 'Priority support', 'Free monthly delivery'], color: '#b45309', icon: '🥇' },
  { name: 'Platinum', min: 10000, perks: ['2x earning rate', 'All perks', 'Dedicated account manager', 'Custom carbon reporting'], color: '#7c3aed', icon: '💎' },
];

export default function GreenRewardsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const m = useMobile();
  const [balance, setBalance] = useState(0);
  const [tier, setTier] = useState('Bronze');
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'client') router.push('/');
    if (user) loadBalance();
  }, [user, loading]);

  const loadBalance = async () => {
    try {
      const res = await fetch('/api/green-points');
      const json = await res.json();
      setBalance(json.balance || 0);
      setTier(json.tier || 'Bronze');
    } catch { /* ignore */ }
    setFetching(false);
  };

  if (loading || !user) return <Spinner />;

  const card = { background: 'white', borderRadius: '14px', padding: m ? '20px' : '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '20px' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Green Rewards" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', maxWidth: '800px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>Green Rewards</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
            <span style={{ fontSize: '16px' }}>🌱</span>
            <span style={{ fontSize: '15px', fontWeight: '700', color: '#16a34a' }}>{balance.toLocaleString()} pts</span>
          </div>
        </div>

        {/* Tier Benefits */}
        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>Tier Benefits</h3>
          <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : 'repeat(2, 1fr)', gap: '12px' }}>
            {TIERS.map(t => {
              const isCurrent = t.name === tier;
              return (
                <div key={t.name} style={{
                  padding: '16px', borderRadius: '12px',
                  border: isCurrent ? `2px solid ${t.color}` : '1px solid #e2e8f0',
                  background: isCurrent ? `${t.color}08` : 'white',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '20px' }}>{t.icon}</span>
                    <span style={{ fontSize: '15px', fontWeight: '700', color: t.color }}>{t.name}</span>
                    {isCurrent && <span style={{ fontSize: '11px', fontWeight: '600', color: 'white', background: t.color, padding: '2px 8px', borderRadius: '6px' }}>CURRENT</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>{t.min.toLocaleString()}+ points</div>
                  {t.perks.map((p, i) => (
                    <div key={i} style={{ fontSize: '13px', color: '#475569', padding: '2px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#16a34a', fontSize: '10px' }}>&#9679;</span> {p}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Rewards Catalog */}
        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>Rewards Catalog</h3>
          <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : 'repeat(2, 1fr)', gap: '12px' }}>
            {REWARDS.map(r => {
              const canRedeem = balance >= r.points;
              return (
                <div key={r.id} style={{
                  padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white',
                  opacity: canRedeem ? 1 : 0.6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '24px' }}>{r.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{r.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{r.desc}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#16a34a' }}>{r.points.toLocaleString()} pts</span>
                    <button disabled={!canRedeem} style={{
                      padding: '6px 16px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: canRedeem ? 'pointer' : 'default',
                      background: canRedeem ? 'linear-gradient(135deg, #16a34a, #15803d)' : '#e2e8f0',
                      color: canRedeem ? 'white' : '#94a3b8', fontFamily: "'Inter', sans-serif",
                    }}>Redeem</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* How to Earn */}
        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>How to Earn Points</h3>
          {[
            { action: 'Choose EV delivery', points: '10-50 pts per job', icon: '⚡' },
            { action: 'Use SaveMode (consolidated)', points: '25 pts per job', icon: '💜' },
            { action: 'Complete 10 deliveries', points: '100 bonus pts', icon: '🏆' },
            { action: 'Refer a friend', points: '200 pts', icon: '👥' },
          ].map((e, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: i < 3 ? '1px solid #f1f5f9' : 'none' }}>
              <span style={{ fontSize: '20px' }}>{e.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>{e.action}</div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#16a34a' }}>{e.points}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

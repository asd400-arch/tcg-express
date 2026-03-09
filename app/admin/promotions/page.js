'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import { supabase } from '../../../lib/supabase';

export default function AdminPromotionsPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    welcomeBonusClaimed: 0, welcomeBonusPending: 0, welcomeBonusTotalPaid: 0,
    zeroCommissionDrivers: [],
    referralTotal: 0, referralCompleted: 0, referralTotalPaid: 0, topReferrers: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user?.role === 'admin') loadStats(); }, [user]);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Welcome Bonus stats
      const [claimedRes, pendingRes] = await Promise.all([
        supabase.from('express_users').select('id', { count: 'exact', head: true }).eq('role', 'driver').eq('welcome_bonus_claimed', true),
        supabase.from('express_users').select('id', { count: 'exact', head: true }).eq('role', 'driver').eq('welcome_bonus_claimed', false),
      ]);

      // Zero Commission drivers (within 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: newDrivers } = await supabase
        .from('express_users')
        .select('id, contact_name, created_at, vehicle_type')
        .eq('role', 'driver')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false });

      // Referral stats
      const { data: referrals } = await supabase.from('referral_rewards').select('*');
      const allReferrals = referrals || [];
      const completedReferrals = allReferrals.filter(r => r.status === 'completed');
      const totalPaid = completedReferrals.reduce((s, r) => s + parseFloat(r.referrer_amount || 0) + parseFloat(r.referred_amount || 0), 0);

      // Top referrers
      const referrerCounts = {};
      allReferrals.forEach(r => {
        if (!referrerCounts[r.referrer_id]) referrerCounts[r.referrer_id] = { count: 0, earned: 0 };
        referrerCounts[r.referrer_id].count++;
        if (r.status === 'completed') referrerCounts[r.referrer_id].earned += parseFloat(r.referrer_amount || 0);
      });
      const topReferrerIds = Object.entries(referrerCounts).sort((a, b) => b[1].count - a[1].count).slice(0, 5);
      let topReferrers = [];
      if (topReferrerIds.length > 0) {
        const { data: users } = await supabase.from('express_users').select('id, contact_name, referral_code').in('id', topReferrerIds.map(([id]) => id));
        const userMap = Object.fromEntries((users || []).map(u => [u.id, u]));
        topReferrers = topReferrerIds.map(([id, data]) => ({
          ...data,
          name: userMap[id]?.contact_name || 'Unknown',
          code: userMap[id]?.referral_code || '',
        }));
      }

      setStats({
        welcomeBonusClaimed: claimedRes.count || 0,
        welcomeBonusPending: pendingRes.count || 0,
        welcomeBonusTotalPaid: (claimedRes.count || 0) * 50,
        zeroCommissionDrivers: (newDrivers || []).map(d => ({
          ...d,
          daysLeft: Math.max(0, 30 - Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000)),
        })),
        referralTotal: allReferrals.length,
        referralCompleted: completedReferrals.length,
        referralTotalPaid: totalPaid,
        topReferrers,
      });
    } catch (e) {
      console.error('Failed to load promo stats:', e);
    }
    setLoading(false);
  };

  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '20px' };
  const statBox = (bg) => ({ textAlign: 'center', padding: '14px', borderRadius: '10px', background: bg });

  if (!user || user.role !== 'admin') return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Promotions" />
      <div style={{ flex: 1, padding: '30px', maxWidth: '900px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', marginBottom: '24px' }}>🎯 Promotions & Referrals</h1>

        {loading ? (
          <p style={{ color: '#64748b' }}>Loading...</p>
        ) : (
          <>
            {/* Welcome Bonus */}
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#7c3aed', marginBottom: '16px' }}>🎁 Welcome Bonus ($50 after 5 deliveries)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div style={statBox('#f5f3ff')}>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: '#7c3aed' }}>{stats.welcomeBonusClaimed}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Claimed</div>
                </div>
                <div style={statBox('#fff7ed')}>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: '#f59e0b' }}>{stats.welcomeBonusPending}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>In Progress</div>
                </div>
                <div style={statBox('#f0fdf4')}>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: '#16a34a' }}>${stats.welcomeBonusTotalPaid}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Total Paid</div>
                </div>
              </div>
            </div>

            {/* Zero Commission */}
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#ea580c', marginBottom: '16px' }}>🔥 Zero Commission Drivers ({stats.zeroCommissionDrivers.length} active)</h3>
              {stats.zeroCommissionDrivers.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#94a3b8' }}>No drivers currently in zero commission period.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {stats.zeroCommissionDrivers.map(d => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '8px', background: '#fff7ed' }}>
                      <div>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{d.contact_name}</span>
                        <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>{d.vehicle_type}</span>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#ea580c' }}>{d.daysLeft} days left</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Referral Program */}
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#3b82f6', marginBottom: '16px' }}>🎉 Referral Program</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                <div style={statBox('#eff6ff')}>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: '#3b82f6' }}>{stats.referralTotal}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Total Referrals</div>
                </div>
                <div style={statBox('#f0fdf4')}>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: '#16a34a' }}>{stats.referralCompleted}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Completed</div>
                </div>
                <div style={statBox('#faf5ff')}>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: '#8b5cf6' }}>${stats.referralTotalPaid.toFixed(0)}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Total Rewards Paid</div>
                </div>
              </div>

              {stats.topReferrers.length > 0 && (
                <>
                  <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '10px' }}>Top Referrers</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {stats.topReferrers.map((r, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '8px', background: '#f8fafc' }}>
                        <div>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{r.name}</span>
                          <span style={{ fontSize: '12px', color: '#3b82f6', fontFamily: 'monospace', marginLeft: '8px' }}>{r.code}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#3b82f6' }}>{r.count} referrals</span>
                          <span style={{ fontSize: '12px', color: '#16a34a', marginLeft: '8px' }}>${r.earned} earned</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

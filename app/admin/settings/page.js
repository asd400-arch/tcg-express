'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import { useToast } from '../../components/Toast';
import useMobile from '../../components/useMobile';
import { JOB_CATEGORIES } from '../../../lib/constants';

export default function AdminSettings() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const m = useMobile();
  const [commission, setCommission] = useState('15');
  const [saved, setSaved] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [categoryRates, setCategoryRates] = useState({});
  const [ratesSaved, setRatesSaved] = useState(false);
  const [stripeConfigured, setStripeConfigured] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'admin') router.push('/');
    if (user && user.role === 'admin') loadSettings();
  }, [user, loading]);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const result = await res.json();
      if (result.data?.commission_rate) {
        setCommission(result.data.commission_rate);
      }
      if (result.data?.category_rates) {
        try { setCategoryRates(JSON.parse(result.data.category_rates)); } catch {}
      }
    } catch (e) {}
    // Check Stripe status
    try {
      const stripeRes = await fetch('/api/admin/stripe-status');
      const stripeData = await stripeRes.json();
      setStripeConfigured(!!stripeData.configured);
    } catch {}
    setSettingsLoading(false);
  };

  const saveSettings = async () => {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'commission_rate', value: commission }),
    });
    const result = await res.json();
    if (result.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success('Settings saved');
    }
  };

  const saveCategoryRates = async () => {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'category_rates', value: JSON.stringify(categoryRates) }),
    });
    const result = await res.json();
    if (result.success) {
      setRatesSaved(true);
      setTimeout(() => setRatesSaved(false), 2000);
      toast.success('Category rates saved');
    } else {
      toast.error(result.error || 'Failed to save');
    }
  };

  if (loading || !user) return null;
  const card = { background: 'white', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '20px' };
  const input = { width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Settings" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', maxWidth: '600px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>⚙️ Platform Settings</h1>

        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Commission Rate</h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>Percentage taken from each completed delivery.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <input type="number" min="0" max="50" style={{ ...input, maxWidth: '120px' }} value={commission} onChange={e => setCommission(e.target.value)} disabled={settingsLoading} />
            <span style={{ fontSize: '16px', fontWeight: '700', color: '#64748b' }}>%</span>
          </div>
          <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>Example: $100 delivery</div>
            <div style={{ display: 'flex', gap: '20px' }}>
              <div><span style={{ fontSize: '12px', color: '#94a3b8' }}>Your Commission</span><div style={{ fontSize: '16px', fontWeight: '700', color: '#059669' }}>${(100 * parseFloat(commission || 0) / 100).toFixed(2)}</div></div>
              <div><span style={{ fontSize: '12px', color: '#94a3b8' }}>Driver Payout</span><div style={{ fontSize: '16px', fontWeight: '700', color: '#3b82f6' }}>${(100 - 100 * parseFloat(commission || 0) / 100).toFixed(2)}</div></div>
            </div>
          </div>
          <button onClick={saveSettings} disabled={settingsLoading} style={{
            padding: '12px 24px', borderRadius: '10px', border: 'none',
            background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white',
            fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
          }}>💾 Save Settings</button>
          {saved && <span style={{ marginLeft: '12px', color: '#10b981', fontSize: '13px', fontWeight: '600' }}>✓ Saved!</span>}
        </div>

        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Category Rate Card</h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>Preset rates auto-fill the client budget when they select a category.</p>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '10px' }}>Standard Categories</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {JOB_CATEGORIES.filter(c => c.group === 'standard').map(cat => (
                <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px', width: '24px', textAlign: 'center' }}>{cat.icon}</span>
                  <span style={{ fontSize: '13px', color: '#374151', flex: 1, minWidth: 0 }}>{cat.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>$</span>
                    <input type="number" min="0" max="100000" style={{ ...input, maxWidth: '90px', padding: '8px 10px' }} value={categoryRates[cat.key] || ''} onChange={e => setCategoryRates(prev => ({ ...prev, [cat.key]: e.target.value }))} disabled={settingsLoading} placeholder="—" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#7c3aed', marginBottom: '10px' }}>Premium Categories</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
              {JOB_CATEGORIES.filter(c => c.group === 'premium').map(cat => (
                <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px', width: '24px', textAlign: 'center' }}>{cat.icon}</span>
                  <span style={{ fontSize: '13px', color: '#374151', flex: 1, minWidth: 0 }}>{cat.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>$</span>
                    <input type="number" min="0" max="100000" style={{ ...input, maxWidth: '90px', padding: '8px 10px' }} value={categoryRates[cat.key] || ''} onChange={e => setCategoryRates(prev => ({ ...prev, [cat.key]: e.target.value }))} disabled={settingsLoading} placeholder="—" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button onClick={saveCategoryRates} disabled={settingsLoading} style={{
            padding: '12px 24px', borderRadius: '10px', border: 'none',
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: 'white',
            fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
          }}>💾 Save Category Rates</button>
          {ratesSaved && <span style={{ marginLeft: '12px', color: '#10b981', fontSize: '13px', fontWeight: '600' }}>✓ Saved!</span>}
        </div>

        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Stripe Payments</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: stripeConfigured ? '#10b981' : '#94a3b8',
              display: 'inline-block',
            }}></span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: stripeConfigured ? '#059669' : '#64748b' }}>
              {stripeConfigured ? 'Connected' : 'Not configured'}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            {stripeConfigured
              ? 'Stripe is active. Clients will be redirected to Stripe Checkout when accepting bids.'
              : 'Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to your environment variables to enable real payments. Currently using simulated escrow.'}
          </p>
        </div>

        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Platform Info</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b', fontSize: '14px' }}>Platform</span><span style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>Tech Chain Express</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b', fontSize: '14px' }}>Version</span><span style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>1.0.0</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b', fontSize: '14px' }}>Stack</span><span style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>Next.js + Supabase</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b', fontSize: '14px' }}>Market</span><span style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>Singapore + SEA</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

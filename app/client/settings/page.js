'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import { useToast } from '../../components/Toast';
import Spinner from '../../components/Spinner';
import useMobile from '../../components/useMobile';
import NotificationPreferences from '../../components/NotificationPreferences';
import { supabase } from '../../../lib/supabase';
import useLocale from '../../components/useLocale';

export default function ClientSettings() {
  const { user, loading, updateUser } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const m = useMobile();
  const { config } = useLocale();

  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  const [referralStats, setReferralStats] = useState({ total: 0, earned: 0, pending: 0 });
  const [referralCopied, setReferralCopied] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'client') router.push('/');
    if (user) {
      setContactName(user.contact_name || '');
      setPhone(user.phone || '');
      setCompanyName(user.company_name || '');
      // Load referral stats
      supabase.from('referral_rewards').select('*').eq('referrer_id', user.id).then(({ data }) => {
        const rewards = data || [];
        const completed = rewards.filter(r => r.status === 'completed');
        setReferralStats({
          total: rewards.length,
          earned: completed.reduce((s, r) => s + parseFloat(r.referrer_amount || 0), 0),
          pending: rewards.filter(r => r.status === 'pending').length,
        });
      });
    }
  }, [user, loading]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: { contact_name: contactName, phone, company_name: companyName } }),
      });
      const result = await res.json();
      if (result.error) { toast.error(result.error); }
      else { updateUser(result.data); toast.success('Profile updated'); }
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setChangingPw(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await res.json();
      if (result.error) { toast.error(result.error); }
      else { toast.success('Password changed'); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }
    } catch { toast.error('Failed to change password'); }
    setChangingPw(false);
  };

  if (loading || !user) return <Spinner />;

  const card = { background: 'white', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '20px' };
  const input = { width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' };
  const label = { fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' };
  const btn = (color) => ({
    padding: '12px 24px', borderRadius: '10px', border: 'none',
    background: `linear-gradient(135deg, ${color}, ${color}dd)`, color: 'white',
    fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Settings" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', maxWidth: '600px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>Account Settings</h1>

        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Profile Information</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={label}>Email</label>
              <input type="email" value={user.email || ''} disabled style={{ ...input, opacity: 0.6, cursor: 'not-allowed' }} />
            </div>
            <div>
              <label style={label}>Contact Name</label>
              <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} style={input} />
            </div>
            <div>
              <label style={label}>Phone</label>
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder={`e.g. ${config.phonePrefix} 9123 4567`} style={input} />
            </div>
            <div>
              <label style={label}>Company Name</label>
              <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your company" style={input} />
            </div>
          </div>
          <button onClick={saveProfile} disabled={saving} style={{ ...btn('#3b82f6'), marginTop: '16px', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        <NotificationPreferences user={user} onSave={updateUser} toast={toast} />

        {/* Referral Program */}
        {user.referral_code && (
          <div style={card}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>🎁 Referral Program</h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>Share your code and earn $30 when your referral completes their first order!</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ flex: 1, padding: '12px 16px', borderRadius: '10px', background: '#f8fafc', border: '2px dashed #3b82f6', fontFamily: 'monospace', fontSize: '18px', fontWeight: '800', color: '#3b82f6', textAlign: 'center', letterSpacing: '2px' }}>
                {user.referral_code}
              </div>
              <button onClick={() => {
                navigator.clipboard.writeText(user.referral_code).then(() => { setReferralCopied(true); setTimeout(() => setReferralCopied(false), 2000); });
              }} style={{ ...btn('#3b82f6'), minWidth: '70px' }}>
                {referralCopied ? '✓ Copied' : 'Copy'}
              </button>
              {typeof navigator !== 'undefined' && navigator.share && (
                <button onClick={() => {
                  navigator.share({ title: 'Join TCG Express', text: `Use my referral code ${user.referral_code} to sign up on TCG Express and get $10 bonus!`, url: 'https://app.techchainglobal.com/signup' }).catch(() => {});
                }} style={btn('#8b5cf6')}>
                  Share
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <div style={{ textAlign: 'center', padding: '10px', borderRadius: '8px', background: '#f8fafc' }}>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#3b82f6' }}>{referralStats.total}</div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Total Referrals</div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px', borderRadius: '8px', background: '#f0fdf4' }}>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#16a34a' }}>${referralStats.earned}</div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Earned</div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px', borderRadius: '8px', background: '#fff7ed' }}>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#f59e0b' }}>{referralStats.pending}</div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Pending</div>
              </div>
            </div>
          </div>
        )}

        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Change Password</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={label}>Current Password</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter current password" style={input} />
            </div>
            <div>
              <label style={label}>New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 6 characters" style={input} />
            </div>
            <div>
              <label style={label}>Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" style={input} />
            </div>
          </div>
          <button onClick={changePassword} disabled={changingPw} style={{ ...btn('#3b82f6'), marginTop: '16px', opacity: changingPw ? 0.7 : 1 }}>
            {changingPw ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      </div>
    </div>
  );
}

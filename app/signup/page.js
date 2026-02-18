'use client';
import { useState } from 'react';
import { useAuth } from '../components/AuthContext';

export default function Signup() {
  const { signup } = useAuth();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState('');
  const [form, setForm] = useState({ email: '', password: '', confirm: '', contact_name: '', phone: '', company_name: '', vehicle_type: '', vehicle_plate: '', license_number: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const input = { width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    const userData = { email: form.email, password: form.password, contact_name: form.contact_name, phone: form.phone, role };
    if (role === 'client') userData.company_name = form.company_name;
    if (role === 'driver') {
      userData.vehicle_type = form.vehicle_type;
      userData.vehicle_plate = form.vehicle_plate;
      userData.license_number = form.license_number;
      userData.driver_status = 'pending';
    }
    const result = await signup(userData);
    if (result.error) { setError(result.error); setLoading(false); return; }
    if (role === 'driver') { setSuccess(true); setLoading(false); }
    else window.location.href = '/client/dashboard';
  };

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '20px' }}>
        <div style={{ maxWidth: '420px', width: '100%', background: 'white', borderRadius: '20px', padding: '40px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', marginBottom: '10px' }}>Registration Submitted!</h2>
          <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>Your driver account is pending admin approval. You'll be notified once approved.</p>
          <a href="/login" style={{ display: 'inline-block', padding: '12px 32px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>Back to Login</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '20px' }}>
      <div style={{ maxWidth: '480px', width: '100%', background: 'white', borderRadius: '20px', padding: '40px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '900', color: 'white', margin: '0 auto 16px' }}>T</div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>Create Account</h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>Join TCG Express</p>
        </div>

        {/* Step 1: Choose Role */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '14px', fontWeight: '600', color: '#374151', textAlign: 'center', marginBottom: '8px' }}>I am a...</p>
            {[
              { key: 'client', icon: '🏢', title: 'Business Client', desc: 'Post delivery jobs and track shipments' },
              { key: 'driver', icon: '🚗', title: 'Delivery Driver', desc: 'Bid on jobs and earn money' },
            ].map(r => (
              <div key={r.key} onClick={() => { setRole(r.key); setStep(2); }} style={{
                padding: '20px', borderRadius: '14px', border: '2px solid #e2e8f0', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '16px', transition: 'all 0.2s',
              }}>
                <span style={{ fontSize: '32px' }}>{r.icon}</span>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>{r.title}</div>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>{r.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', gap: '14px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Full Name *</label>
                <input style={input} value={form.contact_name} onChange={e => set('contact_name', e.target.value)} placeholder="Your name" required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Phone *</label>
                <input style={input} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+65 xxxx xxxx" required />
              </div>
            </div>
            {role === 'client' && (
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Company Name *</label>
                <input style={input} value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Your company" required />
              </div>
            )}
            {role === 'driver' && (
              <>
                <div style={{ display: 'flex', gap: '14px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Vehicle Type *</label>
                    <select style={input} value={form.vehicle_type} onChange={e => set('vehicle_type', e.target.value)} required>
                      <option value="">Select</option>
                      <option value="motorcycle">Motorcycle</option>
                      <option value="car">Car</option>
                      <option value="van">Van</option>
                      <option value="truck">Truck</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Plate Number *</label>
                    <input style={input} value={form.vehicle_plate} onChange={e => set('vehicle_plate', e.target.value)} placeholder="SGX1234A" required />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>License Number *</label>
                  <input style={input} value={form.license_number} onChange={e => set('license_number', e.target.value)} placeholder="S1234567D" required />
                </div>
              </>
            )}
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Email *</label>
              <input type="email" style={input} value={form.email} onChange={e => set('email', e.target.value)} placeholder="your@email.com" required />
            </div>
            <div style={{ display: 'flex', gap: '14px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Password *</label>
                <input type="password" style={input} value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min 6 chars" required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Confirm *</label>
                <input type="password" style={input} value={form.confirm} onChange={e => set('confirm', e.target.value)} placeholder="Re-enter" required />
              </div>
            </div>
            {error && <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fef2f2', color: '#dc2626', fontSize: '13px' }}>{error}</div>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => setStep(1)} style={{ flex: 1, padding: '13px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>← Back</button>
              <button type="submit" disabled={loading} style={{ flex: 2, padding: '13px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", opacity: loading ? 0.7 : 1 }}>{loading ? 'Creating...' : 'Create Account'}</button>
            </div>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <p style={{ color: '#64748b', fontSize: '14px' }}>
            Already have an account? <a href="/login" style={{ color: '#3b82f6', fontWeight: '600', textDecoration: 'none' }}>Sign In</a>
          </p>
        </div>
      </div>
    </div>
  );
}

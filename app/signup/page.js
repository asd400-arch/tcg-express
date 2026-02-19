'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';

export default function Signup() {
  const { signup } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState('');
  const [driverType, setDriverType] = useState('');
  const [form, setForm] = useState({ email: '', password: '', confirm: '', contact_name: '', phone: '', company_name: '', vehicle_type: '', vehicle_plate: '', license_number: '', nric_number: '', business_reg_number: '' });
  const [files, setFiles] = useState({ nric_front: null, nric_back: null, license_photo: null, vehicle_insurance: null, business_reg_cert: null });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const setFile = (k, file) => setFiles(prev => ({ ...prev, [k]: file }));
  const input = { width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' };
  const label = { fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' };
  const sectionTitle = { fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' };

  const uploadFile = async (file, userId, docType) => {
    const ext = file.name.split('.').pop();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', `kyc/${userId}/${docType}.${ext}`);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const result = await res.json();
    if (result.error) throw new Error(result.error);
    return result.url;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }

    // Validate required files for drivers
    if (role === 'driver') {
      if (!files.nric_front || !files.nric_back) { setError('Please upload NRIC front and back photos'); return; }
      if (!files.license_photo) { setError('Please upload your license photo'); return; }
      if (!files.vehicle_insurance) { setError('Please upload your vehicle insurance document'); return; }
      if (driverType === 'company' && !files.business_reg_cert) { setError('Please upload your business registration certificate'); return; }
    }

    setLoading(true);
    try {
      // Phase 1: Create user with text fields
      const userData = { email: form.email, password: form.password, contact_name: form.contact_name, phone: form.phone, role };
      if (role === 'client') {
        userData.company_name = form.company_name;
      }
      if (role === 'driver') {
        userData.vehicle_type = form.vehicle_type;
        userData.vehicle_plate = form.vehicle_plate;
        userData.license_number = form.license_number;
        userData.driver_status = 'pending';
        userData.driver_type = driverType;
        userData.nric_number = form.nric_number;
        if (driverType === 'company') {
          userData.company_name = form.company_name;
          userData.business_reg_number = form.business_reg_number;
        }
      }

      const result = await signup(userData);
      if (result.error) { setError(result.error); setLoading(false); return; }

      // Phase 2: Upload documents for drivers
      if (role === 'driver' && result.data) {
        const userId = result.data.id;
        const urls = {};

        urls.nric_front_url = await uploadFile(files.nric_front, userId, 'nric-front');
        urls.nric_back_url = await uploadFile(files.nric_back, userId, 'nric-back');
        urls.license_photo_url = await uploadFile(files.license_photo, userId, 'license-photo');
        urls.vehicle_insurance_url = await uploadFile(files.vehicle_insurance, userId, 'vehicle-insurance');
        if (driverType === 'company' && files.business_reg_cert) {
          urls.business_reg_cert_url = await uploadFile(files.business_reg_cert, userId, 'business-reg-cert');
        }

        // Phase 3: Patch user with file URLs
        await fetch('/api/auth/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: urls }),
        });

        // Clear the session cookie since driver needs admin approval
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        setSuccess(true);
        setLoading(false);
      } else if (role === 'client') {
        router.push('/verify-email');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong during upload');
      setLoading(false);
    }
  };

  const FileInput = ({ id, label: labelText, accept, required }) => (
    <div style={{ flex: 1, minWidth: '180px' }}>
      <label style={label}>{labelText} {required && '*'}</label>
      <label htmlFor={id} style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '16px 12px', borderRadius: '10px', border: '2px dashed #cbd5e1', background: files[id] ? '#f0fdf4' : '#f8fafc',
        cursor: 'pointer', transition: 'all 0.2s', minHeight: '60px',
      }}>
        <span style={{ fontSize: '20px', marginBottom: '4px' }}>{files[id] ? '✅' : '📄'}</span>
        <span style={{ fontSize: '12px', color: files[id] ? '#16a34a' : '#64748b', textAlign: 'center', wordBreak: 'break-all' }}>
          {files[id] ? files[id].name : 'Click to upload'}
        </span>
      </label>
      <input id={id} type="file" accept={accept || 'image/*,.pdf'} style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) setFile(id, e.target.files[0]); }} />
    </div>
  );

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '20px' }}>
        <div style={{ maxWidth: '420px', width: '100%', background: 'white', borderRadius: '20px', padding: '40px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', marginBottom: '10px' }}>Registration Submitted!</h2>
          <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>Your driver account is pending admin approval. We'll review your documents and notify you once approved.</p>
          <a href="/login" style={{ display: 'inline-block', padding: '12px 32px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>Back to Login</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '20px' }}>
      <div style={{ maxWidth: '520px', width: '100%', background: 'white', borderRadius: '20px', padding: '40px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '900', color: 'white', margin: '0 auto 16px' }}>T</div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>Create Account</h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>Join Tech Chain Express</p>
        </div>

        {/* Step indicators for driver flow */}
        {role === 'driver' && step >= 2 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
            {[1, 2, 3].map(s => (
              <div key={s} style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: step >= s ? '#3b82f6' : '#e2e8f0',
              }} />
            ))}
          </div>
        )}

        {/* Step 1: Choose Role */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '14px', fontWeight: '600', color: '#374151', textAlign: 'center', marginBottom: '8px' }}>I am a...</p>
            {[
              { key: 'client', icon: '🏢', title: 'Business Client', desc: 'Post delivery jobs and track shipments' },
              { key: 'driver', icon: '🚗', title: 'Delivery Driver', desc: 'Bid on jobs and earn money' },
            ].map(r => (
              <div key={r.key} onClick={() => { setRole(r.key); setStep(r.key === 'driver' ? 2 : 3); }} style={{
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

        {/* Step 2: Choose Driver Type (drivers only) */}
        {step === 2 && role === 'driver' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '14px', fontWeight: '600', color: '#374151', textAlign: 'center', marginBottom: '8px' }}>Driver type</p>
            {[
              { key: 'individual', icon: '👤', title: 'Individual Driver', desc: 'Personal vehicle, freelance deliveries' },
              { key: 'company', icon: '🏗️', title: 'Company Driver', desc: 'Registered business with fleet management' },
            ].map(t => (
              <div key={t.key} onClick={() => { setDriverType(t.key); setStep(3); }} style={{
                padding: '20px', borderRadius: '14px', border: '2px solid #e2e8f0', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '16px', transition: 'all 0.2s',
              }}>
                <span style={{ fontSize: '32px' }}>{t.icon}</span>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>{t.title}</div>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>{t.desc}</div>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => { setStep(1); setRole(''); }} style={{ padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>← Back</button>
          </div>
        )}

        {/* Step 3: Details form */}
        {step === 3 && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* Personal Details */}
            <div>
              <h3 style={sectionTitle}>Personal Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', gap: '14px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={label}>Full Name *</label>
                    <input style={input} value={form.contact_name} onChange={e => set('contact_name', e.target.value)} placeholder="Your name" required />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={label}>Phone *</label>
                    <input style={input} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+65 xxxx xxxx" required />
                  </div>
                </div>
                {role === 'driver' && (
                  <div>
                    <label style={label}>NRIC Number *</label>
                    <input style={input} value={form.nric_number} onChange={e => set('nric_number', e.target.value)} placeholder="S1234567D" required />
                  </div>
                )}
              </div>
            </div>

            {/* Client-specific: Company */}
            {role === 'client' && (
              <div>
                <label style={label}>Company Name *</label>
                <input style={input} value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Your company" required />
              </div>
            )}

            {/* Driver: Vehicle Details */}
            {role === 'driver' && (
              <div>
                <h3 style={sectionTitle}>Vehicle Details</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', gap: '14px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={label}>Vehicle Type *</label>
                      <select style={input} value={form.vehicle_type} onChange={e => set('vehicle_type', e.target.value)} required>
                        <option value="">Select</option>
                        <option value="motorcycle">Motorcycle</option>
                        <option value="car">Car</option>
                        <option value="van">Van</option>
                        <option value="truck">Truck</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={label}>Plate Number *</label>
                      <input style={input} value={form.vehicle_plate} onChange={e => set('vehicle_plate', e.target.value)} placeholder="SGX1234A" required />
                    </div>
                  </div>
                  <div>
                    <label style={label}>License Number *</label>
                    <input style={input} value={form.license_number} onChange={e => set('license_number', e.target.value)} placeholder="License number" required />
                  </div>
                </div>
              </div>
            )}

            {/* Driver Company: Business details */}
            {role === 'driver' && driverType === 'company' && (
              <div>
                <h3 style={sectionTitle}>Company Details</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={label}>Company Name *</label>
                    <input style={input} value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Your company name" required />
                  </div>
                  <div>
                    <label style={label}>Business Registration Number *</label>
                    <input style={input} value={form.business_reg_number} onChange={e => set('business_reg_number', e.target.value)} placeholder="e.g. 201912345A" required />
                  </div>
                </div>
              </div>
            )}

            {/* Driver: KYC Document Uploads */}
            {role === 'driver' && (
              <div>
                <h3 style={sectionTitle}>KYC Documents</h3>
                <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>Upload clear photos or scans of your documents (JPG, PNG, or PDF)</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  <FileInput id="nric_front" label="NRIC Front" required />
                  <FileInput id="nric_back" label="NRIC Back" required />
                  <FileInput id="license_photo" label="License Photo" required />
                  <FileInput id="vehicle_insurance" label="Vehicle Insurance" required />
                  {driverType === 'company' && (
                    <FileInput id="business_reg_cert" label="Business Reg Cert" required />
                  )}
                </div>
              </div>
            )}

            {/* Credentials */}
            <div>
              <h3 style={sectionTitle}>Account Credentials</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={label}>Email *</label>
                  <input type="email" style={input} value={form.email} onChange={e => set('email', e.target.value)} placeholder="your@email.com" required />
                </div>
                <div style={{ display: 'flex', gap: '14px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={label}>Password *</label>
                    <input type="password" style={input} value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min 6 chars" required />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={label}>Confirm *</label>
                    <input type="password" style={input} value={form.confirm} onChange={e => set('confirm', e.target.value)} placeholder="Re-enter" required />
                  </div>
                </div>
              </div>
            </div>

            {error && <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fef2f2', color: '#dc2626', fontSize: '13px' }}>{error}</div>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => { if (role === 'driver') setStep(2); else { setStep(1); setRole(''); } }} style={{ flex: 1, padding: '13px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>← Back</button>
              <button type="submit" disabled={loading} style={{ flex: 2, padding: '13px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", opacity: loading ? 0.7 : 1 }}>{loading ? (role === 'driver' ? 'Uploading documents...' : 'Creating...') : 'Create Account'}</button>
            </div>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <p style={{ color: '#64748b', fontSize: '14px' }}>
            Already have an account? <a href="/login" style={{ color: '#3b82f6', fontWeight: '600', textDecoration: 'none' }}>Sign In</a>
          </p>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
          <p style={{ color: '#94a3b8', fontSize: '12px' }}>
            By creating an account, you agree to our{' '}
            <a href="/terms" style={{ color: '#94a3b8', textDecoration: 'underline' }}>Terms of Service</a>
            {' and '}
            <a href="/privacy" style={{ color: '#94a3b8', textDecoration: 'underline' }}>Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}

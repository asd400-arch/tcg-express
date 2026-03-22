'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../components/AuthContext';
import TermsModal from '../components/TermsModal';
import LiabilityCapModal from '../components/LiabilityCapModal';
import { VEHICLE_MODES } from '../../lib/fares';

function SignupForm({ initialLocale = 'sg' }) {
  const locale = initialLocale;
  const { signup } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState('');

  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam === 'driver') { setRole('driver'); setStep(2); }
    else if (roleParam === 'client') { setRole('client'); setStep(3); }
  }, []);
  const [driverType, setDriverType] = useState('');
  const [form, setForm] = useState({ email: '', password: '', confirm: '', first_name: '', last_name: '', phone: '', company_name: '', vehicle_type: '', vehicle_plate: '', license_number: '', nric_number: '', business_reg_number: '', is_ev_vehicle: false, referral_code: '' });
  const [referralStatus, setReferralStatus] = useState(null); // null | { valid, name }
  const [files, setFiles] = useState({ nric_front: null, nric_back: null, license_photo: null, vehicle_insurance: null, business_reg_cert: null });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tcAccepted, setTcAccepted] = useState(false);
  const [driverTcAccepted, setDriverTcAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsHighlightSection, setTermsHighlightSection] = useState(null);
  const [showLiabilityModal, setShowLiabilityModal] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k, v) => { setForm(prev => ({ ...prev, [k]: v })); setErrors(prev => { const n = { ...prev }; delete n[k]; return n; }); };
  const setFile = (k, file) => { setFiles(prev => ({ ...prev, [k]: file })); setErrors(prev => { const n = { ...prev }; delete n[k]; return n; }); };
  const inputStyle = (field) => ({ width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', background: '#f8fafc', border: errors[field] ? '1.5px solid #ef4444' : '1px solid #e2e8f0', color: '#1e293b', outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' });
  const input = { width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' };
  const label = { fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' };
  const errText = (field) => errors[field] ? { fontSize: '11px', color: '#ef4444', marginTop: '4px' } : { display: 'none' };
  const req = { color: '#ef4444', marginLeft: '2px' };
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
    const errs = {};
    if (!form.first_name.trim()) errs.first_name = 'First name is required';
    if (!form.last_name.trim()) errs.last_name = 'Last name is required';
    if (!form.phone.trim()) errs.phone = 'Phone number is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email address';
    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 6) errs.password = 'Min 6 characters';
    if (!form.confirm) errs.confirm = 'Please confirm password';
    else if (form.password !== form.confirm) errs.confirm = 'Passwords do not match';
    if (role === 'client' && !form.company_name.trim()) errs.company_name = 'Company name is required';
    if (role === 'driver') {
      if (!form.nric_number.trim()) errs.nric_number = locale === 'id' ? 'NIK number is required' : 'NRIC number is required';
      if (!form.vehicle_type) errs.vehicle_type = 'Select a vehicle type';
      if (!form.vehicle_plate.trim()) errs.vehicle_plate = 'Plate number is required';
      if (!form.license_number.trim()) errs.license_number = 'License number is required';
      if (!files.nric_front) errs.nric_front = 'Required';
      if (locale !== 'id' && !files.nric_back) errs.nric_back = 'Required';
      if (!files.license_photo) errs.license_photo = 'Required';
      if (!files.vehicle_insurance) errs.vehicle_insurance = 'Required';
      if (driverType === 'company') {
        if (!form.company_name.trim()) errs.company_name = 'Company name is required';
        if (!form.business_reg_number.trim()) errs.business_reg_number = 'Business reg number is required';
        if (!files.business_reg_cert) errs.business_reg_cert = 'Required';
      }
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setError('Please fix the highlighted fields');
      return;
    }

    setLoading(true);
    try {
      // Phase 1: Create user with text fields
      const userData = { email: form.email, password: form.password, contact_name: `${form.first_name} ${form.last_name}`.trim(), phone: form.phone, role, locale };
      if (form.referral_code.trim() && referralStatus?.valid) userData.referred_by = form.referral_code.trim();
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
        userData.is_ev_vehicle = form.is_ev_vehicle;
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
        if (locale !== 'id') urls.nric_back_url = await uploadFile(files.nric_back, userId, 'nric-back');
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
      <label style={label}>{labelText} {required && <span style={req}>*</span>}</label>
      <label htmlFor={id} style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '16px 12px', borderRadius: '10px', border: errors[id] ? '2px dashed #ef4444' : '2px dashed #cbd5e1', background: files[id] ? '#f0fdf4' : '#f8fafc',
        cursor: 'pointer', transition: 'all 0.2s', minHeight: '60px',
      }}>
        <span style={{ fontSize: '20px', marginBottom: '4px' }}>{files[id] ? '✅' : '📄'}</span>
        <span style={{ fontSize: '12px', color: files[id] ? '#16a34a' : errors[id] ? '#ef4444' : '#64748b', textAlign: 'center', wordBreak: 'break-all' }}>
          {files[id] ? files[id].name : errors[id] || 'Click to upload'}
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
          <a href={locale === 'id' ? '/id/login' : '/login'} style={{ display: 'inline-block', padding: '12px 32px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>Back to Login</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '20px' }}>
      <div style={{ maxWidth: '520px', width: '100%', background: 'white', borderRadius: '20px', padding: '40px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="/logo_C_typographic_1200.png" alt="TCG Express" style={{ width: '56px', height: '56px', borderRadius: '14px', objectFit: 'contain', margin: '0 auto 16px', display: 'block' }} />
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>Create Account</h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>Join TCG Express</p>
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
                    <label style={label}>First Name<span style={req}>*</span></label>
                    <input style={inputStyle('first_name')} value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="First name" />
                    <div style={errText('first_name')}>{errors.first_name}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={label}>Last Name<span style={req}>*</span></label>
                    <input style={inputStyle('last_name')} value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Last name" />
                    <div style={errText('last_name')}>{errors.last_name}</div>
                  </div>
                </div>
                <div>
                  <label style={label}>Phone<span style={req}>*</span></label>
                  <input style={inputStyle('phone')} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder={locale === 'id' ? '+62 xxx xxxx xxxx' : '+65 xxxx xxxx'} />
                  <div style={errText('phone')}>{errors.phone}</div>
                </div>
                {role === 'driver' && (
                  <div>
                    <label style={label}>{locale === 'id' ? 'NIK (KTP)' : 'NRIC Number'}<span style={req}>*</span></label>
                    <input style={inputStyle('nric_number')} value={form.nric_number} onChange={e => set('nric_number', e.target.value)} placeholder={locale === 'id' ? '3271234567890001' : 'S1234567D'} />
                    <div style={errText('nric_number')}>{errors.nric_number}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Client-specific: Company */}
            {role === 'client' && (
              <div>
                <label style={label}>Company Name<span style={req}>*</span></label>
                <input style={inputStyle('company_name')} value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Your company" />
                <div style={errText('company_name')}>{errors.company_name}</div>
              </div>
            )}

            {/* Driver: Vehicle Details */}
            {role === 'driver' && (
              <div>
                <h3 style={sectionTitle}>Vehicle Details</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', gap: '14px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={label}>Vehicle Type<span style={req}>*</span></label>
                      <select style={inputStyle('vehicle_type')} value={form.vehicle_type} onChange={e => set('vehicle_type', e.target.value)}>
                        <option value="">Select</option>
                        {VEHICLE_MODES.filter(v => v.key !== 'special').map(v => (
                          <option key={v.key} value={v.key}>{v.icon} {v.label}</option>
                        ))}
                      </select>
                      <div style={errText('vehicle_type')}>{errors.vehicle_type}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={label}>Plate Number<span style={req}>*</span></label>
                      <input style={inputStyle('vehicle_plate')} value={form.vehicle_plate} onChange={e => set('vehicle_plate', e.target.value)} placeholder={locale === 'id' ? 'B 1234 XYZ' : 'SGX1234A'} />
                      <div style={errText('vehicle_plate')}>{errors.vehicle_plate}</div>
                    </div>
                  </div>
                  <div>
                    <label style={label}>License Number<span style={req}>*</span></label>
                    <input style={inputStyle('license_number')} value={form.license_number} onChange={e => set('license_number', e.target.value)} placeholder="License number" />
                    <div style={errText('license_number')}>{errors.license_number}</div>
                  </div>
                  <div style={{ padding: '14px', borderRadius: '10px', background: form.is_ev_vehicle ? '#f0fdf4' : '#f8fafc', border: form.is_ev_vehicle ? '1px solid #86efac' : '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>⚡</span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>Electric Vehicle (EV)</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>My vehicle is fully electric</div>
                      </div>
                    </div>
                    <div onClick={() => set('is_ev_vehicle', !form.is_ev_vehicle)} style={{
                      width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer', position: 'relative',
                      background: form.is_ev_vehicle ? '#16a34a' : '#cbd5e1', transition: 'background 0.2s',
                    }}>
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '10px', background: 'white', position: 'absolute', top: '2px',
                        left: form.is_ev_vehicle ? '22px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </div>
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
                    <label style={label}>Company Name<span style={req}>*</span></label>
                    <input style={inputStyle('company_name')} value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Your company name" />
                    <div style={errText('company_name')}>{errors.company_name}</div>
                  </div>
                  <div>
                    <label style={label}>Business Registration Number<span style={req}>*</span></label>
                    <input style={inputStyle('business_reg_number')} value={form.business_reg_number} onChange={e => set('business_reg_number', e.target.value)} placeholder="e.g. 201912345A" />
                    <div style={errText('business_reg_number')}>{errors.business_reg_number}</div>
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
                  {locale === 'id' ? (
                    <>
                      <FileInput id="nric_front" label="KTP (Depan)" required />
                      <FileInput id="license_photo" label="SIM" required />
                      <FileInput id="vehicle_insurance" label="STNK" required />
                    </>
                  ) : (
                    <>
                      <FileInput id="nric_front" label="NRIC Front" required />
                      <FileInput id="nric_back" label="NRIC Back" required />
                      <FileInput id="license_photo" label="License Photo" required />
                      <FileInput id="vehicle_insurance" label="Vehicle Insurance" required />
                    </>
                  )}
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
                  <label style={label}>Email<span style={req}>*</span></label>
                  <input type="email" style={inputStyle('email')} value={form.email} onChange={e => set('email', e.target.value)} placeholder="your@email.com" />
                  <div style={errText('email')}>{errors.email}</div>
                </div>
                <div style={{ display: 'flex', gap: '14px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={label}>Password<span style={req}>*</span></label>
                    <input type="password" style={inputStyle('password')} value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min 6 chars" />
                    <div style={errText('password')}>{errors.password}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={label}>Confirm<span style={req}>*</span></label>
                    <input type="password" style={inputStyle('confirm')} value={form.confirm} onChange={e => set('confirm', e.target.value)} placeholder="Re-enter" />
                    <div style={errText('confirm')}>{errors.confirm}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Referral Code (optional) */}
            <div style={{ marginBottom: '2px' }}>
              <label style={label}>Referral Code <span style={{ color: '#94a3b8', fontWeight: '400' }}>(optional)</span></label>
              <input
                style={inputStyle('referral_code')}
                value={form.referral_code}
                onChange={e => {
                  const val = e.target.value.toUpperCase();
                  set('referral_code', val);
                  setReferralStatus(null);
                }}
                onBlur={async () => {
                  if (!form.referral_code.trim() || form.referral_code.trim().length < 4) { setReferralStatus(null); return; }
                  try {
                    const res = await fetch(`/api/referral/validate?code=${encodeURIComponent(form.referral_code.trim())}`);
                    const data = await res.json();
                    setReferralStatus(data);
                  } catch { setReferralStatus({ valid: false }); }
                }}
                placeholder="TCG-XXXX"
              />
              {referralStatus?.valid && (
                <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: '500', marginTop: '4px' }}>✅ Referred by: {referralStatus.name}</div>
              )}
              {referralStatus && !referralStatus.valid && (
                <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: '500', marginTop: '4px' }}>Invalid referral code</div>
              )}
            </div>

            {/* T&C Checkboxes */}
            {role === 'client' && (
              <div style={{ padding: '14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#374151', lineHeight: '1.5' }}>
                  <input type="checkbox" checked={tcAccepted} onChange={e => setTcAccepted(e.target.checked)} style={{ marginTop: '3px', accentColor: '#3b82f6' }} />
                  <span>
                    I agree to the{' '}
                    <span onClick={(e) => { e.preventDefault(); setTermsHighlightSection(null); setShowTermsModal(true); }} style={{ color: '#3b82f6', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline' }}>Terms and Conditions</span>
                  </span>
                </label>
              </div>
            )}
            {role === 'driver' && (
              <div style={{ padding: '14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#374151', lineHeight: '1.5' }}>
                  <input type="checkbox" checked={driverTcAccepted} onChange={e => setDriverTcAccepted(e.target.checked)} style={{ marginTop: '3px', accentColor: '#3b82f6' }} />
                  <span>
                    I agree to the{' '}
                    <span onClick={(e) => { e.preventDefault(); setTermsHighlightSection(null); setShowTermsModal(true); }} style={{ color: '#3b82f6', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline' }}>Driver Partner Terms and Conditions</span>
                  </span>
                </label>
                <div style={{ marginTop: '8px', paddingLeft: '26px' }}>
                  <span onClick={() => setShowLiabilityModal(true)} style={{ color: '#dc2626', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline', fontSize: '12px' }}>View Liability Caps</span>
                </div>
              </div>
            )}

            {error && <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fef2f2', color: '#dc2626', fontSize: '13px' }}>{error}</div>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => { if (role === 'driver') setStep(2); else { setStep(1); setRole(''); } }} style={{ flex: 1, padding: '13px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>← Back</button>
              <button type="submit" disabled={loading || (role === 'client' && !tcAccepted) || (role === 'driver' && !driverTcAccepted)} style={{ flex: 2, padding: '13px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", opacity: (loading || (role === 'client' && !tcAccepted) || (role === 'driver' && !driverTcAccepted)) ? 0.5 : 1 }}>{loading ? (role === 'driver' ? 'Uploading documents...' : 'Creating...') : 'Create Account'}</button>
            </div>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <p style={{ color: '#64748b', fontSize: '14px' }}>
            Already have an account? <a href={locale === 'id' ? '/id/login' : '/login'} style={{ color: '#3b82f6', fontWeight: '600', textDecoration: 'none' }}>Sign In</a>
          </p>
        </div>

        {showTermsModal && <TermsModal onClose={() => setShowTermsModal(false)} highlightSection={termsHighlightSection} locale={locale} />}
        {showLiabilityModal && <LiabilityCapModal onClose={() => setShowLiabilityModal(false)} locale={locale} />}
      </div>
    </div>
  );
}

export default function Signup({ initialLocale = 'sg' }) {
  return (
    <Suspense>
      <SignupForm initialLocale={initialLocale} />
    </Suspense>
  );
}

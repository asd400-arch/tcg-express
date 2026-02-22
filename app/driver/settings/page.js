'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import { useToast } from '../../components/Toast';
import Spinner from '../../components/Spinner';
import useMobile from '../../components/useMobile';
import NotificationPreferences from '../../components/NotificationPreferences';

export default function DriverSettings() {
  const { user, loading, updateUser } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const m = useMobile();

  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [nricNumber, setNricNumber] = useState('');
  const [businessRegNumber, setBusinessRegNumber] = useState('');
  const [isEvVehicle, setIsEvVehicle] = useState(false);
  const [preferredNavApp, setPreferredNavApp] = useState('google_maps');
  const [autoNavigate, setAutoNavigate] = useState(true);
  const [nearbyJobAlerts, setNearbyJobAlerts] = useState(true);
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  const [uploading, setUploading] = useState({});

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'driver') router.push('/');
    if (user) {
      setContactName(user.contact_name || '');
      setPhone(user.phone || '');
      setVehicleType(user.vehicle_type || '');
      setVehiclePlate(user.vehicle_plate || '');
      setLicenseNumber(user.license_number || '');
      setNricNumber(user.nric_number || '');
      setBusinessRegNumber(user.business_reg_number || '');
      setIsEvVehicle(user.is_ev_vehicle || false);
      setPreferredNavApp(user.preferred_nav_app || 'google_maps');
      setAutoNavigate(user.auto_navigate !== false);
      setNearbyJobAlerts(user.nearby_job_alerts !== false);
    }
  }, [user, loading]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const updates = { contact_name: contactName, phone, vehicle_type: vehicleType, vehicle_plate: vehiclePlate, license_number: licenseNumber, nric_number: nricNumber, is_ev_vehicle: isEvVehicle, preferred_nav_app: preferredNavApp, auto_navigate: autoNavigate, nearby_job_alerts: nearbyJobAlerts };
      if (user.driver_type === 'company') {
        updates.business_reg_number = businessRegNumber;
      }
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
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

  const uploadDoc = async (file, docType, urlField) => {
    setUploading(prev => ({ ...prev, [docType]: true }));
    try {
      const ext = file.name.split('.').pop();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', `kyc/${user.id}/${docType}.${ext}`);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      const uploadResult = await uploadRes.json();
      if (uploadResult.error) { toast.error(uploadResult.error); return; }

      const patchRes = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: { [urlField]: uploadResult.url } }),
      });
      const patchResult = await patchRes.json();
      if (patchResult.error) { toast.error(patchResult.error); }
      else { updateUser(patchResult.data); toast.success('Document uploaded'); }
    } catch { toast.error('Upload failed'); }
    setUploading(prev => ({ ...prev, [docType]: false }));
  };

  const isPdf = (url) => url && url.toLowerCase().endsWith('.pdf');

  if (loading || !user) return <Spinner />;

  const card = { background: 'white', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '20px' };
  const input = { width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' };
  const label = { fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' };
  const btn = (color) => ({
    padding: '12px 24px', borderRadius: '10px', border: 'none',
    background: `linear-gradient(135deg, ${color}, ${color}dd)`, color: 'white',
    fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
  });
  const selectStyle = { ...input, appearance: 'auto' };

  const docItems = [
    { key: 'nric-front', urlField: 'nric_front_url', label: 'NRIC Front' },
    { key: 'nric-back', urlField: 'nric_back_url', label: 'NRIC Back' },
    { key: 'license-photo', urlField: 'license_photo_url', label: 'License Photo' },
    { key: 'vehicle-insurance', urlField: 'vehicle_insurance_url', label: 'Vehicle Insurance' },
    ...(user.driver_type === 'company' ? [{ key: 'business-reg-cert', urlField: 'business_reg_cert_url', label: 'Business Reg Cert' }] : []),
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Settings" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', maxWidth: '600px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>Account Settings</h1>

        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Personal Information</h3>
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
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. +65 9123 4567" style={input} />
            </div>
          </div>
        </div>

        {/* Identity Information */}
        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Identity Information</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={label}>Driver Type</label>
              <input type="text" value={user.driver_type ? user.driver_type.charAt(0).toUpperCase() + user.driver_type.slice(1) : 'Not set'} disabled style={{ ...input, opacity: 0.6, cursor: 'not-allowed' }} />
            </div>
            <div>
              <label style={label}>NRIC Number</label>
              <input type="text" value={nricNumber} onChange={e => setNricNumber(e.target.value)} placeholder="e.g. S1234567D" style={input} />
            </div>
            {user.driver_type === 'company' && (
              <div>
                <label style={label}>Business Registration Number</label>
                <input type="text" value={businessRegNumber} onChange={e => setBusinessRegNumber(e.target.value)} placeholder="e.g. 201912345A" style={input} />
              </div>
            )}
          </div>
        </div>

        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Vehicle Details</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={label}>Vehicle Type</label>
              <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} style={selectStyle}>
                <option value="">Select vehicle type</option>
                <option value="motorcycle">🏍️ Motorcycle</option>
                <option value="car">🚗 Car</option>
                <option value="mpv">🚙 MPV</option>
                <option value="van_1_7m">🚐 1.7m Van</option>
                <option value="van_2_4m">🚐 2.4m Van</option>
                <option value="lorry_10ft">🚚 10ft Lorry</option>
                <option value="lorry_14ft">🚚 14ft Lorry</option>
                <option value="lorry_24ft">🚛 24ft Lorry</option>
              </select>
            </div>
            <div>
              <label style={label}>Vehicle Plate</label>
              <input type="text" value={vehiclePlate} onChange={e => setVehiclePlate(e.target.value)} placeholder="e.g. SBA1234A" style={input} />
            </div>
            <div>
              <label style={label}>License Number</label>
              <input type="text" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} placeholder="Driver license number" style={input} />
            </div>
            <div style={{ padding: '14px', borderRadius: '10px', background: isEvVehicle ? '#f0fdf4' : '#f8fafc', border: isEvVehicle ? '1px solid #86efac' : '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>⚡</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>Electric Vehicle (EV)</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>My vehicle is fully electric</div>
                </div>
              </div>
              <div onClick={() => setIsEvVehicle(!isEvVehicle)} style={{
                width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer', position: 'relative',
                background: isEvVehicle ? '#16a34a' : '#cbd5e1', transition: 'background 0.2s',
              }}>
                <div style={{
                  width: '20px', height: '20px', borderRadius: '10px', background: 'white', position: 'absolute', top: '2px',
                  left: isEvVehicle ? '22px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* Navigation & Geo-fencing Preferences */}
        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Navigation & Alerts</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={label}>Preferred Navigation App</label>
              <select value={preferredNavApp} onChange={e => setPreferredNavApp(e.target.value)} style={input}>
                <option value="google_maps">Google Maps</option>
                <option value="waze">Waze</option>
                <option value="apple_maps">Apple Maps</option>
              </select>
            </div>
            <div style={{ padding: '14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>Auto-Navigate</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Auto-launch navigation after completing a job</div>
              </div>
              <div onClick={() => setAutoNavigate(!autoNavigate)} style={{
                width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer', position: 'relative',
                background: autoNavigate ? '#3b82f6' : '#cbd5e1', transition: 'background 0.2s',
              }}>
                <div style={{
                  width: '20px', height: '20px', borderRadius: '10px', background: 'white', position: 'absolute', top: '2px',
                  left: autoNavigate ? '22px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
            </div>
            <div style={{ padding: '14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>Nearby Job Alerts</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Get notified of nearby available jobs while delivering</div>
              </div>
              <div onClick={() => setNearbyJobAlerts(!nearbyJobAlerts)} style={{
                width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer', position: 'relative',
                background: nearbyJobAlerts ? '#3b82f6' : '#cbd5e1', transition: 'background 0.2s',
              }}>
                <div style={{
                  width: '20px', height: '20px', borderRadius: '10px', background: 'white', position: 'absolute', top: '2px',
                  left: nearbyJobAlerts ? '22px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
            </div>
          </div>
        </div>

        <button onClick={saveProfile} disabled={saving} style={{ ...btn('#10b981'), marginBottom: '20px', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving...' : 'Save All Changes'}
        </button>

        {/* KYC Documents */}
        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>KYC Documents</h3>
          <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>View your uploaded documents or re-upload new ones</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {docItems.map(doc => {
              const url = user[doc.urlField];
              return (
                <div key={doc.key} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                  {url ? (
                    isPdf(url) ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" style={{ width: '64px', height: '48px', borderRadius: '6px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', textDecoration: 'none', flexShrink: 0 }}>📋</a>
                    ) : (
                      <a href={url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0 }}>
                        <img src={url} alt={doc.label} style={{ width: '64px', height: '48px', objectFit: 'cover', borderRadius: '6px' }} />
                      </a>
                    )
                  ) : (
                    <div style={{ width: '64px', height: '48px', borderRadius: '6px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', opacity: 0.5, flexShrink: 0 }}>📄</div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>{doc.label}</div>
                    <div style={{ fontSize: '11px', color: url ? '#10b981' : '#94a3b8' }}>{url ? 'Uploaded' : 'Not uploaded'}</div>
                  </div>
                  <label style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: '#3b82f6', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap' }}>
                    {uploading[doc.key] ? 'Uploading...' : (url ? 'Re-upload' : 'Upload')}
                    <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) uploadDoc(e.target.files[0], doc.key, doc.urlField); }} disabled={uploading[doc.key]} />
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        <NotificationPreferences user={user} onSave={updateUser} toast={toast} />

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
          <button onClick={changePassword} disabled={changingPw} style={{ ...btn('#10b981'), marginTop: '16px', opacity: changingPw ? 0.7 : 1 }}>
            {changingPw ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      </div>
    </div>
  );
}

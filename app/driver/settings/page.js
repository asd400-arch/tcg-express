'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import { useToast } from '../../components/Toast';
import Spinner from '../../components/Spinner';
import useMobile from '../../components/useMobile';

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
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'driver') router.push('/');
    if (user) {
      setContactName(user.contact_name || '');
      setPhone(user.phone || '');
      setVehicleType(user.vehicle_type || '');
      setVehiclePlate(user.vehicle_plate || '');
      setLicenseNumber(user.license_number || '');
    }
  }, [user, loading]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, updates: { contact_name: contactName, phone, vehicle_type: vehicleType, vehicle_plate: vehiclePlate, license_number: licenseNumber } }),
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
        body: JSON.stringify({ userId: user.id, currentPassword, newPassword }),
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
  const selectStyle = { ...input, appearance: 'auto' };

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

        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Vehicle Details</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={label}>Vehicle Type</label>
              <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} style={selectStyle}>
                <option value="">Select vehicle type</option>
                <option value="motorcycle">Motorcycle</option>
                <option value="car">Car</option>
                <option value="van">Van</option>
                <option value="truck">Truck</option>
                <option value="lorry">Lorry</option>
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
          </div>
        </div>

        <button onClick={saveProfile} disabled={saving} style={{ ...btn('#10b981'), marginBottom: '20px', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving...' : 'Save All Changes'}
        </button>

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

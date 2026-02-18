'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import ChatBox from '../../components/ChatBox';
import LiveMap from '../../components/LiveMap';
import { supabase } from '../../../lib/supabase';
import useMobile from '../../components/useMobile';

export default function DriverMyJobs() {
  const { user, loading } = useAuth();
  const m = useMobile();
  const [jobs, setJobs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('active');
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    if (!loading && !user) window.location.href = '/login';
    if (!loading && user && user.role !== 'driver') window.location.href = '/';
    if (user && user.role === 'driver') loadJobs();
  }, [user, loading]);

  const loadJobs = async () => {
    const { data } = await supabase.from('express_jobs').select('*').eq('assigned_driver_id', user.id).order('created_at', { ascending: false });
    setJobs(data || []);
  };

  const selectJob = (job) => {
    setSelected(job);
    setActiveTab('info');
  };

  const updateStatus = async (status) => {
    const updates = { status };
    if (status === 'delivered') updates.completed_at = new Date().toISOString();
    await supabase.from('express_jobs').update(updates).eq('id', selected.id);
    setSelected({ ...selected, ...updates });
    loadJobs();
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `jobs/${selected.id}/${type}_${Date.now()}.${ext}`;
    let result = await supabase.storage.from('express-uploads').upload(path, file);
    if (result.error) {
      await supabase.storage.createBucket('express-uploads', { public: true });
      result = await supabase.storage.from('express-uploads').upload(path, file);
      if (result.error) { alert('Upload failed'); setUploading(false); return; }
    }
    const { data: urlData } = supabase.storage.from('express-uploads').getPublicUrl(path);
    const field = type === 'pickup' ? 'pickup_photo' : type === 'delivery' ? 'delivery_photo' : 'invoice_file';
    await supabase.from('express_jobs').update({ [field]: urlData.publicUrl }).eq('id', selected.id);
    setSelected({ ...selected, [field]: urlData.publicUrl });
    setUploading(false);
  };

  if (loading || !user) return null;

  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '16px' };
  const statusColor = { assigned: '#f59e0b', pickup_confirmed: '#f59e0b', in_transit: '#06b6d4', delivered: '#10b981', confirmed: '#10b981', completed: '#059669', cancelled: '#ef4444' };
  const statusFlow = {
    assigned: { next: 'pickup_confirmed', label: '📸 Confirm Pickup', color: '#f59e0b' },
    pickup_confirmed: { next: 'in_transit', label: '🚚 Start Delivery', color: '#06b6d4' },
    in_transit: { next: 'delivered', label: '✅ Mark Delivered', color: '#10b981' },
  };

  const filtered = jobs.filter(j => {
    if (filter === 'active') return ['assigned','pickup_confirmed','in_transit','delivered'].includes(j.status);
    return ['confirmed','completed'].includes(j.status);
  });

  const showMap = selected && ['assigned','pickup_confirmed','in_transit'].includes(selected.status);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="My Jobs" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', overflowX: 'hidden' }}>
        {!selected ? (
          <>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>📦 My Jobs</h1>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              {['active', 'completed'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: filter === f ? '#10b981' : '#e2e8f0', color: filter === f ? 'white' : '#64748b',
                  fontSize: '13px', fontWeight: '600', fontFamily: "'Inter', sans-serif", textTransform: 'capitalize',
                }}>{f}</button>
              ))}
            </div>
            {filtered.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: '40px' }}>
                <p style={{ color: '#64748b' }}>No {filter} jobs</p>
              </div>
            ) : filtered.map(job => (
              <div key={job.id} onClick={() => selectJob(job)} style={{ ...card, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>{job.job_number}</span>
                      <span style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: '700', background: `${statusColor[job.status]}15`, color: statusColor[job.status], textTransform: 'uppercase' }}>{job.status.replace(/_/g, ' ')}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#374151' }}>{job.item_description}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>📍 {job.pickup_address} → {job.delivery_address}</div>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#059669' }}>${job.driver_payout || job.final_amount}</div>
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            {/* Header */}
            <div style={{ marginBottom: '20px' }}>
              <span onClick={() => setSelected(null)} style={{ color: '#64748b', fontSize: '13px', cursor: 'pointer' }}>← Back to My Jobs</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b' }}>{selected.job_number}</h1>
                <span style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', background: `${statusColor[selected.status]}15`, color: statusColor[selected.status], textTransform: 'uppercase' }}>{selected.status.replace(/_/g, ' ')}</span>
              </div>
            </div>

            {/* Status Action - Top Priority */}
            {statusFlow[selected.status] && (
              <button onClick={() => updateStatus(statusFlow[selected.status].next)} style={{
                padding: '16px 28px', borderRadius: '12px', border: 'none', width: '100%', marginBottom: '20px',
                background: `linear-gradient(135deg, ${statusFlow[selected.status].color}, ${statusFlow[selected.status].color}cc)`,
                color: 'white', fontSize: '18px', fontWeight: '700', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                boxShadow: `0 4px 14px ${statusFlow[selected.status].color}40`,
              }}>{statusFlow[selected.status].label}</button>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#f1f5f9', borderRadius: '10px', padding: '4px' }}>
              {['info', ...(showMap ? ['tracking'] : []), 'uploads', 'messages'].map(t => (
                <button key={t} onClick={() => setActiveTab(t)} style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: activeTab === t ? 'white' : 'transparent', color: activeTab === t ? '#1e293b' : '#64748b',
                  fontSize: '13px', fontWeight: '600', fontFamily: "'Inter', sans-serif",
                  boxShadow: activeTab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', textTransform: 'capitalize',
                }}>{t === 'info' ? 'Job Info' : t}</button>
              ))}
            </div>

            {/* Info Tab */}
            {activeTab === 'info' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: '16px' }}>
                  <div style={card}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '10px' }}>📍 Pickup</h3>
                    <div style={{ fontSize: '14px', color: '#374151' }}>{selected.pickup_address}</div>
                    {selected.pickup_contact && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>👤 {selected.pickup_contact} {selected.pickup_phone}</div>}
                    {selected.pickup_instructions && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>📝 {selected.pickup_instructions}</div>}
                  </div>
                  <div style={card}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '10px' }}>📦 Delivery</h3>
                    <div style={{ fontSize: '14px', color: '#374151' }}>{selected.delivery_address}</div>
                    {selected.delivery_contact && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>👤 {selected.delivery_contact} {selected.delivery_phone}</div>}
                    {selected.delivery_instructions && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>📝 {selected.delivery_instructions}</div>}
                  </div>
                </div>
                <div style={{ ...card, display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                  <div><div style={{ fontSize: '12px', color: '#94a3b8' }}>Total</div><div style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>${selected.final_amount}</div></div>
                  <div><div style={{ fontSize: '12px', color: '#94a3b8' }}>Commission ({selected.commission_rate}%)</div><div style={{ fontSize: '20px', fontWeight: '800', color: '#ef4444' }}>-${selected.commission_amount}</div></div>
                  <div><div style={{ fontSize: '12px', color: '#94a3b8' }}>Your Payout</div><div style={{ fontSize: '20px', fontWeight: '800', color: '#059669' }}>${selected.driver_payout}</div></div>
                </div>
              </>
            )}

            {/* Tracking Tab */}
            {activeTab === 'tracking' && showMap && (
              <LiveMap jobId={selected.id} driverId={user.id} isDriver={true} />
            )}

            {/* Uploads Tab */}
            {activeTab === 'uploads' && (
              <div style={card}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>📸 Upload Evidence</h3>
                <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr 1fr', gap: '16px' }}>
                  {[
                    { key: 'pickup', label: 'Pickup Photo', field: 'pickup_photo' },
                    { key: 'delivery', label: 'Delivery Photo', field: 'delivery_photo' },
                    { key: 'invoice', label: 'Invoice/Receipt', field: 'invoice_file' },
                  ].map(item => (
                    <div key={item.key} style={{ border: '2px dashed #e2e8f0', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                      <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '10px' }}>{item.label}</label>
                      {selected[item.field] ? (
                        <div>
                          {item.key !== 'invoice' ? (
                            <img src={selected[item.field]} alt={item.label} style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '8px' }} />
                          ) : (
                            <a href={selected[item.field]} target="_blank" style={{ color: '#3b82f6', fontSize: '14px', fontWeight: '600' }}>📄 View File</a>
                          )}
                          <div style={{ fontSize: '11px', color: '#10b981', fontWeight: '600', marginTop: '8px' }}>✓ Uploaded</div>
                        </div>
                      ) : (
                        <label style={{ cursor: 'pointer', display: 'block' }}>
                          <div style={{ fontSize: '32px', marginBottom: '8px' }}>{item.key === 'invoice' ? '📄' : '📷'}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>Tap to upload</div>
                          <input type="file" accept={item.key === 'invoice' ? '.pdf,.jpg,.png' : 'image/*'} onChange={e => handleFileUpload(e, item.key)} style={{ display: 'none' }} disabled={uploading} />
                        </label>
                      )}
                    </div>
                  ))}
                </div>
                {uploading && <div style={{ marginTop: '12px', color: '#3b82f6', fontSize: '13px', fontWeight: '600', textAlign: 'center' }}>⏳ Uploading...</div>}
              </div>
            )}

            {/* Messages Tab */}
            {activeTab === 'messages' && (
              <ChatBox jobId={selected.id} userId={user.id} receiverId={selected.client_id} userRole="driver" />
            )}
          </>
        )}
      </div>
    </div>
  );
}

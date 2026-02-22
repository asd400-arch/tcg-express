'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import { supabase } from '../../../lib/supabase';
import useMobile from '../../components/useMobile';

const CONTRACT_DURATIONS = [
  { key: '3_months', label: '3 Months', months: 3 },
  { key: '6_months', label: '6 Months', months: 6 },
  { key: '12_months', label: '12 Months', months: 12 },
];

const STATUS_CONFIG = {
  submitted: { label: 'Submitted', color: '#3b82f6', icon: '📨' },
  under_review: { label: 'Under Review', color: '#f59e0b', icon: '🔍' },
  quote_sent: { label: 'Quote Sent', color: '#8b5cf6', icon: '📝' },
  accepted: { label: 'Accepted', color: '#16a34a', icon: '✅' },
  rejected: { label: 'Rejected', color: '#ef4444', icon: '❌' },
};

export default function RFQPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const m = useMobile();
  const [tab, setTab] = useState('new');
  const [quotes, setQuotes] = useState([]);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ndaAccepted, setNdaAccepted] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', duration: '3_months',
    estimated_volume: '', pickup_regions: '', delivery_regions: '',
    vehicle_types: '', special_requirements: '',
  });

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'client') router.push('/');
    if (user) loadQuotes();
  }, [user, loading]);

  const loadQuotes = async () => {
    setQuotesLoading(true);
    const { data } = await supabase
      .from('corp_premium_requests')
      .select('*')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false });
    setQuotes(data || []);
    setQuotesLoading(false);
  };

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleFileUpload = async (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    setUploading(true);
    const uploaded = [];
    for (const file of selected) {
      const ext = file.name.split('.').pop();
      const path = `rfq/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('uploads').upload(path, file);
      if (!error) {
        const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);
        uploaded.push({ name: file.name, url: urlData.publicUrl, path });
      }
    }
    setFiles(prev => [...prev, ...uploaded]);
    setUploading(false);
  };

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!form.title || !form.description) { toast.error('Title and description are required'); return; }
    if (!ndaAccepted) { toast.error('Please accept the NDA agreement'); return; }

    setSubmitting(true);
    const duration = CONTRACT_DURATIONS.find(d => d.key === form.duration);
    const { error } = await supabase.from('corp_premium_requests').insert([{
      client_id: user.id,
      title: form.title,
      description: form.description,
      contract_duration: duration?.months || 3,
      estimated_volume: form.estimated_volume,
      pickup_regions: form.pickup_regions,
      delivery_regions: form.delivery_regions,
      vehicle_types: form.vehicle_types,
      special_requirements: form.special_requirements,
      nda_accepted: true,
      attachments: files.map(f => f.url),
      status: 'submitted',
    }]);
    setSubmitting(false);

    if (error) { toast.error('Failed to submit: ' + error.message); return; }

    toast.success('RFQ submitted successfully!');
    setForm({ title: '', description: '', duration: '3_months', estimated_volume: '', pickup_regions: '', delivery_regions: '', vehicle_types: '', special_requirements: '' });
    setFiles([]);
    setNdaAccepted(false);
    setTab('tracking');
    loadQuotes();
  };

  if (loading || !user) return <Spinner />;

  const card = { background: 'white', borderRadius: '14px', padding: m ? '20px' : '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '20px' };
  const input = { width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' };
  const label = { fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="New Delivery" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', maxWidth: '720px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>Request for Quote (RFQ)</h1>
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>Submit a long-term delivery contract request for 3, 6, or 12 months</p>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#f1f5f9', borderRadius: '12px', padding: '4px' }}>
          {[
            { key: 'new', label: 'New RFQ', icon: '📋' },
            { key: 'tracking', label: 'My Quotes', icon: '📊' },
          ].map(t => (
            <div key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: '10px', borderRadius: '10px', textAlign: 'center', cursor: 'pointer',
              background: tab === t.key ? 'white' : 'transparent',
              boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}>
              <span style={{ fontSize: '14px' }}>{t.icon}</span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: tab === t.key ? '#1e293b' : '#64748b', marginLeft: '6px' }}>{t.label}</span>
            </div>
          ))}
        </div>

        {tab === 'new' && (
          <>
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Project Details</h3>
              <div style={{ marginBottom: '14px' }}><label style={label}>Project Title *</label><input style={input} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Daily warehouse-to-retail delivery" /></div>
              <div style={{ marginBottom: '14px' }}><label style={label}>Description *</label><textarea style={{ ...input, height: '100px', resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe your delivery needs, frequency, item types, SLA requirements..." /></div>
              <div style={{ marginBottom: '14px' }}>
                <label style={label}>Contract Duration</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {CONTRACT_DURATIONS.map(d => (
                    <div key={d.key} onClick={() => set('duration', d.key)} style={{
                      flex: 1, padding: '14px', borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
                      border: form.duration === d.key ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                      background: form.duration === d.key ? '#eff6ff' : 'white',
                    }}>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: form.duration === d.key ? '#3b82f6' : '#1e293b' }}>{d.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div><label style={label}>Est. Monthly Volume</label><input style={input} value={form.estimated_volume} onChange={e => set('estimated_volume', e.target.value)} placeholder="e.g. 200 deliveries/month" /></div>
                <div><label style={label}>Vehicle Types Needed</label><input style={input} value={form.vehicle_types} onChange={e => set('vehicle_types', e.target.value)} placeholder="e.g. Van, 1-ton lorry" /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div><label style={label}>Pickup Regions</label><input style={input} value={form.pickup_regions} onChange={e => set('pickup_regions', e.target.value)} placeholder="e.g. Jurong, Tuas" /></div>
                <div><label style={label}>Delivery Regions</label><input style={input} value={form.delivery_regions} onChange={e => set('delivery_regions', e.target.value)} placeholder="e.g. Islandwide" /></div>
              </div>
              <div><label style={label}>Special Requirements</label><textarea style={{ ...input, height: '60px', resize: 'vertical' }} value={form.special_requirements} onChange={e => set('special_requirements', e.target.value)} placeholder="Temperature control, hazmat, time windows, insurance..." /></div>
            </div>

            {/* File Upload */}
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>Attachments</h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>Upload specs, blueprints, route maps, or any supporting documents</p>
              <label style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '20px', borderRadius: '10px', border: '2px dashed #e2e8f0', cursor: 'pointer',
                background: '#f8fafc', marginBottom: files.length > 0 ? '14px' : '0',
              }}>
                <span style={{ fontSize: '20px' }}>{uploading ? '...' : '📎'}</span>
                <span style={{ fontSize: '14px', color: '#64748b', fontWeight: '500' }}>{uploading ? 'Uploading...' : 'Click to upload files'}</span>
                <input type="file" multiple onChange={handleFileUpload} style={{ display: 'none' }} accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.dwg" />
              </label>
              {files.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {files.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f1f5f9', borderRadius: '8px' }}>
                      <span style={{ fontSize: '13px', color: '#1e293b', fontWeight: '500' }}>{f.name}</span>
                      <span onClick={() => removeFile(i)} style={{ cursor: 'pointer', color: '#ef4444', fontSize: '14px', fontWeight: '700' }}>x</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* NDA */}
            <div style={{ ...card, border: ndaAccepted ? '2px solid #16a34a' : '2px solid #e2e8f0', background: ndaAccepted ? '#f0fdf4' : 'white' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div onClick={() => setNdaAccepted(!ndaAccepted)} style={{
                  width: '22px', height: '22px', borderRadius: '6px', border: ndaAccepted ? 'none' : '2px solid #cbd5e1',
                  background: ndaAccepted ? '#16a34a' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: '2px',
                }}>
                  {ndaAccepted && <span style={{ color: 'white', fontSize: '14px', fontWeight: '700' }}>&#10003;</span>}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>Non-Disclosure Agreement (NDA)</div>
                  <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.6', margin: 0 }}>
                    I acknowledge that all information shared in this RFQ is confidential. TCG Express and its partners agree not to disclose project details,
                    pricing, routes, or any proprietary information to third parties. This NDA applies for the duration of the contract and 2 years thereafter.
                  </p>
                </div>
              </div>
            </div>

            <button onClick={handleSubmit} disabled={submitting} style={{
              width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white',
              fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
              opacity: submitting ? 0.7 : 1,
            }}>{submitting ? 'Submitting...' : 'Submit RFQ'}</button>
          </>
        )}

        {tab === 'tracking' && (
          <div style={card}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '14px' }}>Quote Status Tracking</h3>
            {quotesLoading ? <Spinner /> : quotes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
                <p style={{ color: '#64748b', fontSize: '14px' }}>No quotes submitted yet</p>
              </div>
            ) : (
              quotes.map(q => {
                const status = STATUS_CONFIG[q.status] || STATUS_CONFIG.submitted;
                return (
                  <div key={q.id} style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '12px', background: 'white' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e293b' }}>{q.title}</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{new Date(q.created_at).toLocaleDateString()} - {q.contract_duration} months</div>
                      </div>
                      <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: `${status.color}15`, color: status.color }}>
                        {status.icon} {status.label}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 8px' }}>{q.description?.slice(0, 120)}{q.description?.length > 120 ? '...' : ''}</p>
                    {/* Status timeline */}
                    <div style={{ display: 'flex', gap: '4px', marginTop: '10px' }}>
                      {Object.entries(STATUS_CONFIG).map(([key, cfg], i) => {
                        const steps = Object.keys(STATUS_CONFIG);
                        const currentIdx = steps.indexOf(q.status);
                        const stepIdx = i;
                        const isActive = stepIdx <= currentIdx;
                        return (
                          <div key={key} style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ height: '4px', borderRadius: '2px', background: isActive ? cfg.color : '#e2e8f0', marginBottom: '4px' }} />
                            <span style={{ fontSize: '10px', color: isActive ? cfg.color : '#94a3b8', fontWeight: '600' }}>{cfg.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

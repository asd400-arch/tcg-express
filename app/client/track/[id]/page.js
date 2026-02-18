'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../components/AuthContext';
import LiveMap from '../../../components/LiveMap';
import Spinner from '../../../components/Spinner';
import { supabase } from '../../../../lib/supabase';
import { use } from 'react';

export default function ClientTrackPage({ params }) {
  const resolvedParams = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [jobId] = useState(resolvedParams.id);
  const [job, setJob] = useState(null);
  const [driver, setDriver] = useState(null);
  const [eta, setEta] = useState(null);
  const [distance, setDistance] = useState(null);
  const [delivered, setDelivered] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'client') router.push('/');
  }, [user, loading]);

  useEffect(() => {
    if (!jobId || !user) return;

    const loadData = async () => {
      const { data: jobData } = await supabase
        .from('express_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (!jobData || jobData.client_id !== user.id) {
        router.push('/client/jobs');
        return;
      }
      setJob(jobData);
      if (jobData.status === 'delivered' || jobData.status === 'confirmed' || jobData.status === 'completed') {
        setDelivered(true);
      }

      if (jobData.assigned_driver_id) {
        const { data: driverData } = await supabase
          .from('express_users')
          .select('id, contact_name, phone, vehicle_type, vehicle_plate, driver_rating')
          .eq('id', jobData.assigned_driver_id)
          .single();
        setDriver(driverData);
      }
    };
    loadData();
  }, [jobId, user]);

  // Real-time job status subscription
  useEffect(() => {
    if (!jobId) return;
    const channel = supabase
      .channel(`track-job-${jobId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'express_jobs',
        filter: `id=eq.${jobId}`,
      }, (payload) => {
        setJob(payload.new);
        if (payload.new.status === 'delivered' || payload.new.status === 'confirmed' || payload.new.status === 'completed') {
          setDelivered(true);
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [jobId]);

  const handleEtaUpdate = useCallback((newEta, newDistance) => {
    setEta(newEta);
    setDistance(newDistance);
  }, []);

  if (loading || !user || !job) return <Spinner />;

  const statusColor = { assigned: '#f59e0b', pickup_confirmed: '#f59e0b', in_transit: '#06b6d4', delivered: '#10b981', confirmed: '#10b981', completed: '#059669' };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
      {/* Minimal Header */}
      <div style={{
        height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', background: 'white', borderBottom: '1px solid #e2e8f0', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a href={`/client/jobs/${jobId}`} style={{ color: '#64748b', fontSize: '13px', textDecoration: 'none', fontWeight: '600' }}>← Back</a>
          <span style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>{job.job_number}</span>
        </div>
        <span style={{
          padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
          background: `${statusColor[job.status] || '#94a3b8'}15`,
          color: statusColor[job.status] || '#94a3b8',
          textTransform: 'uppercase',
        }}>
          {job.status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Delivered banner */}
      {delivered && (
        <div style={{
          padding: '14px 20px', background: 'linear-gradient(135deg, #10b981, #059669)',
          color: 'white', textAlign: 'center', fontSize: '15px', fontWeight: '700', flexShrink: 0,
        }}>
          ✅ Delivery Complete!
          <a href={`/client/jobs/${jobId}`} style={{ color: 'white', marginLeft: '12px', textDecoration: 'underline', fontSize: '13px' }}>View Details</a>
        </div>
      )}

      {/* Map */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <LiveMap
          jobId={jobId}
          driverId={job.assigned_driver_id}
          isDriver={false}
          fullscreen={true}
          mapHeight="100%"
          onEtaUpdate={handleEtaUpdate}
        />
      </div>

      {/* Bottom overlay panel */}
      <div style={{
        flexShrink: 0, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(10px)',
        borderTop: '1px solid #e2e8f0', padding: '16px 20px',
      }}>
        {driver ? (
          <div>
            {/* Driver info row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%', background: '#e2e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', fontWeight: '700', color: '#64748b', flexShrink: 0,
              }}>
                {driver.contact_name?.[0] || 'D'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>{driver.contact_name}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  {driver.vehicle_type} {driver.vehicle_plate && `• ${driver.vehicle_plate}`} {driver.driver_rating && `• ⭐ ${driver.driver_rating}`}
                </div>
              </div>
              {driver.phone && (
                <a href={`tel:${driver.phone}`} style={{
                  padding: '8px 14px', borderRadius: '8px', background: '#3b82f6', color: 'white',
                  fontSize: '13px', fontWeight: '600', textDecoration: 'none', flexShrink: 0,
                }}>📞 Call</a>
              )}
            </div>

            {/* ETA / Distance / Status row */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1, padding: '10px', background: '#f1f5f9', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>ETA</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>
                  {eta !== null ? `${eta} min` : '--'}
                </div>
              </div>
              <div style={{ flex: 1, padding: '10px', background: '#f1f5f9', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>Distance</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>
                  {distance !== null ? `${distance} km` : '--'}
                </div>
              </div>
              <div style={{ flex: 1, padding: '10px', background: '#f1f5f9', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>Status</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: statusColor[job.status] || '#64748b', textTransform: 'capitalize' }}>
                  {job.status.replace(/_/g, ' ')}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '14px' }}>
            Loading driver info...
          </div>
        )}
      </div>
    </div>
  );
}

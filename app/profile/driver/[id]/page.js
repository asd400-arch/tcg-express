'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../components/AuthContext';
import Sidebar from '../../../components/Sidebar';
import Spinner from '../../../components/Spinner';
import { supabase } from '../../../../lib/supabase';
import useMobile from '../../../components/useMobile';
import { use } from 'react';

export default function DriverProfile({ params }) {
  const resolvedParams = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const m = useMobile();
  const [driver, setDriver] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (user) loadProfile();
  }, [user, loading]);

  const loadProfile = async () => {
    setDataLoading(true);
    const [driverRes, reviewsRes] = await Promise.all([
      supabase.from('express_users')
        .select('id, contact_name, vehicle_type, vehicle_plate, driver_rating, total_deliveries, created_at')
        .eq('id', resolvedParams.id)
        .eq('role', 'driver')
        .single(),
      supabase.from('express_reviews')
        .select('*, client:client_id(contact_name)')
        .eq('driver_id', resolvedParams.id)
        .eq('reviewer_role', 'client')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    setDriver(driverRes.data);
    setReviews(reviewsRes.data || []);
    setDataLoading(false);
  };

  if (loading || !user) return <Spinner />;

  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '16px' };

  if (dataLoading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>
    </div>
  );

  if (!driver) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px' }}>
        <div style={card}>
          <p style={{ color: '#64748b', textAlign: 'center', padding: '40px' }}>Driver not found</p>
        </div>
      </div>
    </div>
  );

  const rating = driver.driver_rating || 5.0;
  const deliveries = driver.total_deliveries || 0;
  const joined = new Date(driver.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', overflowX: 'hidden', maxWidth: '720px' }}>
        {/* Driver Header */}
        <div style={{ ...card, textAlign: 'center', padding: '30px 20px' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', fontWeight: '700', color: 'white', margin: '0 auto 14px',
          }}>{driver.contact_name?.[0] || 'D'}</div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>{driver.contact_name}</h1>
          <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>
            {driver.vehicle_type} {driver.vehicle_plate && `\u2022 ${driver.vehicle_plate}`}
          </div>
          <div style={{ fontSize: '13px', color: '#94a3b8' }}>Member since {joined}</div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
          <div style={{ ...card, textAlign: 'center', marginBottom: 0 }}>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#f59e0b' }}>{parseFloat(rating).toFixed(1)}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Rating</div>
          </div>
          <div style={{ ...card, textAlign: 'center', marginBottom: 0 }}>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#3b82f6' }}>{deliveries}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Deliveries</div>
          </div>
          <div style={{ ...card, textAlign: 'center', marginBottom: 0 }}>
            <div style={{ fontSize: '24px' }}>{'★'.repeat(Math.round(rating))}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Stars</div>
          </div>
        </div>

        {/* Reviews */}
        <div style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Client Reviews ({reviews.length})</h3>
          {reviews.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '20px' }}>No reviews yet</p>
          ) : (
            reviews.map(r => (
              <div key={r.id} style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#f59e0b', fontSize: '14px' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{r.client?.contact_name || 'Client'}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                {r.review_text && <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>{r.review_text}</p>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import WalletPage from '../../components/wallet/WalletPage';
import useMobile from '../../components/useMobile';

export default function DriverWalletPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const m = useMobile();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'driver') router.push('/');
  }, [user, loading]);

  if (loading || !user) return <Spinner />;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Wallet" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', overflowX: 'hidden' }}>
        <WalletPage />
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import useMobile from '../useMobile';
import { useWallet } from '@/lib/hooks/useWallet';
import { formatSGD } from '@/lib/paynow';
import WalletBalanceCard from './WalletBalanceCard';
import TransactionList from './TransactionList';
import TopupModal from './TopupModal';
import WithdrawalModal from './WithdrawalModal';
import WalletSettingsModal from './WalletSettingsModal';

const card: React.CSSProperties = {
  background: 'white',
  borderRadius: '14px',
  padding: '20px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  border: '1px solid #f1f5f9',
};

export default function WalletPage() {
  const m = useMobile();
  const { data, loading, error, refetch } = useWallet();

  const [showTopup, setShowTopup] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{
          width: '40px', height: '40px',
          border: '4px solid #e2e8f0', borderTopColor: '#3b82f6',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
        <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Failed to load wallet</div>
        <div style={{ fontSize: '14px', marginBottom: '20px' }}>{error}</div>
        <button
          onClick={refetch}
          style={{
            padding: '10px 24px', borderRadius: '10px', border: 'none',
            background: '#3b82f6', color: 'white', fontSize: '14px', fontWeight: '600',
            cursor: 'pointer', fontFamily: "'Inter', sans-serif",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const { wallet, recent_transactions, pending_withdrawals, monthly_earned, monthly_spent, monthly_withdrawn } = data;

  const stats = [
    { label: 'This Month Earned', value: formatSGD(monthly_earned), icon: '📈', color: '#10b981' },
    { label: 'This Month Spent', value: formatSGD(monthly_spent), icon: '📉', color: '#ef4444' },
    { label: 'Pending Withdrawals', value: pending_withdrawals.length.toString(), icon: '⏳', color: '#f59e0b' },
    { label: 'Wallet Status', value: wallet.status.charAt(0).toUpperCase() + wallet.status.slice(1), icon: wallet.status === 'active' ? '✅' : '⚠️', color: wallet.status === 'active' ? '#10b981' : '#f59e0b' },
  ];

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', margin: 0 }}>My Wallet</h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0' }}>Manage your funds</p>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          style={{
            width: '40px', height: '40px', borderRadius: '12px',
            border: '1px solid #e2e8f0', background: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: '18px',
          }}
        >
          ⚙️
        </button>
      </div>

      {/* Balance Card */}
      <div style={{ marginBottom: '20px' }}>
        <WalletBalanceCard
          wallet={wallet}
          onTopup={() => setShowTopup(true)}
          onWithdraw={() => setShowWithdraw(true)}
        />
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: m ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: '12px',
        marginBottom: '20px',
      }}>
        {stats.map((s, i) => (
          <div key={i} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500', marginBottom: '6px' }}>{s.label}</div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: s.color }}>{s.value}</div>
              </div>
              <span style={{ fontSize: '20px' }}>{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Pending Withdrawals Alert */}
      {pending_withdrawals.length > 0 && (
        <div style={{
          background: '#fef3c7', borderRadius: '14px', padding: '16px 18px',
          marginBottom: '20px', border: '1px solid #fde68a',
        }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#92400e', marginBottom: '10px' }}>
            ⏳ Pending Withdrawals ({pending_withdrawals.length})
          </div>
          {pending_withdrawals.map((w) => (
            <div key={w.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0',
              borderBottom: '1px solid rgba(146,64,14,0.1)',
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#78350f' }}>
                  {formatSGD(w.amount)} via {w.method === 'paynow' ? 'PayNow' : 'Bank Transfer'}
                </div>
                <div style={{ fontSize: '11px', color: '#a16207' }}>
                  {new Date(w.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <span style={{
                fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px',
                background: 'rgba(146,64,14,0.1)', color: '#92400e', textTransform: 'uppercase',
              }}>
                {w.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Recent Transactions */}
      <div style={{ ...card, padding: '20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '0 4px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: 0 }}>Recent Transactions</h2>
        </div>
        <TransactionList transactions={recent_transactions} />
      </div>

      {/* Modals */}
      <TopupModal
        open={showTopup}
        onClose={() => setShowTopup(false)}
        onSuccess={refetch}
      />
      <WithdrawalModal
        open={showWithdraw}
        onClose={() => setShowWithdraw(false)}
        onSuccess={refetch}
        wallet={wallet}
      />
      <WalletSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onSuccess={refetch}
        wallet={wallet}
      />
    </div>
  );
}

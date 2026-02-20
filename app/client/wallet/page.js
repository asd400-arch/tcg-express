'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import { useToast } from '../../components/Toast';
import useMobile from '../../components/useMobile';

const TOPUP_OPTIONS = [
  { amount: 50, bonus: 0 },
  { amount: 100, bonus: 5 },
  { amount: 200, bonus: 15 },
  { amount: 500, bonus: 50 },
];

export default function WalletPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const m = useMobile();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [topupAmount, setTopupAmount] = useState(100);
  const [customAmount, setCustomAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (user) fetchWallet();
  }, [user, loading]);

  const fetchWallet = async () => {
    const res = await fetch('/api/wallet');
    const data = await res.json();
    setWallet(data.wallet);
    setTransactions(data.transactions || []);
  };

  const handleTopup = async () => {
    const amount = customAmount ? parseFloat(customAmount) : topupAmount;
    if (!amount || amount < 10) { toast.error('Minimum top-up is $10'); return; }
    setProcessing(true);
    try {
      const res = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Wallet topped up $${amount}${data.bonus ? ` + $${data.bonus} bonus!` : ''}`);
        setCustomAmount('');
        fetchWallet();
      } else if (data.clientSecret) {
        toast.info('PayNow payment initiated. Complete in your banking app.');
        // For Stripe payment sheet - would need Stripe.js integration
        fetchWallet();
      } else {
        toast.error(data.error || 'Top-up failed');
      }
    } catch { toast.error('Top-up failed'); }
    finally { setProcessing(false); }
  };

  const getBonus = (amt) => {
    if (amt >= 500) return 50;
    if (amt >= 200) return 15;
    if (amt >= 100) return 5;
    return 0;
  };

  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '16px' };
  const txnIcon = { topup: '💰', bonus: '🎁', payment: '💳', refund: '↩️', points_earn: '⭐', points_redeem: '🔄', points_payment: '⭐' };
  const txnColor = { topup: '#059669', bonus: '#7c3aed', payment: '#ef4444', refund: '#3b82f6', points_earn: '#f59e0b', points_redeem: '#f59e0b', points_payment: '#f59e0b' };

  if (loading || !user) return null;

  const selectedAmount = customAmount ? parseFloat(customAmount) : topupAmount;
  const selectedBonus = getBonus(selectedAmount || 0);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Wallet" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', maxWidth: '800px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>💰 My Wallet</h1>

        {/* Balance Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <div style={{ ...card, background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', marginBottom: 0 }}>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Available Balance</div>
            <div style={{ fontSize: '28px', fontWeight: '800' }}>${wallet ? (parseFloat(wallet.balance) + parseFloat(wallet.bonus_balance)).toFixed(2) : '0.00'}</div>
            {wallet && parseFloat(wallet.bonus_balance) > 0 && (
              <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>Includes ${parseFloat(wallet.bonus_balance).toFixed(2)} bonus</div>
            )}
          </div>
          <div style={{ ...card, background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', marginBottom: 0 }}>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Reward Points</div>
            <div style={{ fontSize: '28px', fontWeight: '800' }}>{wallet?.points || 0}</div>
            <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>= ${((wallet?.points || 0) / 100).toFixed(2)} value</div>
          </div>
          <div style={{ ...card, background: 'linear-gradient(135deg, #059669, #047857)', color: 'white', marginBottom: 0 }}>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Currency</div>
            <div style={{ fontSize: '28px', fontWeight: '800' }}>SGD</div>
            <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>Singapore Dollar</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#f1f5f9', borderRadius: '10px', padding: '4px' }}>
          {['overview', 'topup', 'history'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: tab === t ? 'white' : 'transparent', color: tab === t ? '#1e293b' : '#64748b',
              fontSize: '13px', fontWeight: '600', fontFamily: "'Inter', sans-serif",
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', textTransform: 'capitalize',
            }}>{t === 'topup' ? 'Top Up' : t}</button>
          ))}
        </div>

        {/* Top Up Tab */}
        {tab === 'topup' && (
          <div style={card}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Top Up Wallet</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              {TOPUP_OPTIONS.map(opt => (
                <button key={opt.amount} onClick={() => { setTopupAmount(opt.amount); setCustomAmount(''); }}
                  style={{
                    padding: '16px', borderRadius: '12px', border: `2px solid ${topupAmount === opt.amount && !customAmount ? '#3b82f6' : '#e2e8f0'}`,
                    background: topupAmount === opt.amount && !customAmount ? '#eff6ff' : 'white',
                    cursor: 'pointer', fontFamily: "'Inter', sans-serif", textAlign: 'center',
                  }}>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>${opt.amount}</div>
                  {opt.bonus > 0 && (
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#059669', marginTop: '4px' }}>+${opt.bonus} bonus</div>
                  )}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '6px', display: 'block' }}>Custom Amount</label>
              <input
                type="number"
                placeholder="Enter amount (min $10)"
                value={customAmount}
                onChange={e => { setCustomAmount(e.target.value); }}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' }}
              />
            </div>

            {selectedBonus > 0 && (
              <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: '10px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#059669', fontWeight: '600' }}>🎁 Bonus Credit</span>
                <span style={{ fontSize: '13px', color: '#059669', fontWeight: '700' }}>+${selectedBonus}.00</span>
              </div>
            )}

            <button onClick={handleTopup} disabled={processing}
              style={{
                width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
                background: processing ? '#94a3b8' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: 'white', fontSize: '15px', fontWeight: '700', cursor: processing ? 'default' : 'pointer',
                fontFamily: "'Inter', sans-serif",
              }}>
              {processing ? 'Processing...' : `Top Up $${selectedAmount || 0}`}
            </button>

            <div style={{ marginTop: '16px', padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '8px' }}>Bonus Tiers</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>$100+ → $5 bonus • $200+ → $15 bonus • $500+ → $50 bonus</div>
            </div>
          </div>
        )}

        {/* Overview / History */}
        {(tab === 'overview' || tab === 'history') && (
          <div style={card}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>
              {tab === 'overview' ? 'Recent Transactions' : 'Transaction History'}
            </h3>
            {transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
                <div>No transactions yet</div>
              </div>
            ) : (
              (tab === 'overview' ? transactions.slice(0, 10) : transactions).map(txn => (
                <div key={txn.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>{txnIcon[txn.type] || '💰'}</span>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{txn.description}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(txn.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: txnColor[txn.type] || '#1e293b' }}>
                      {parseFloat(txn.amount) >= 0 ? '+' : ''}${parseFloat(txn.amount).toFixed(2)}
                    </div>
                    {txn.points_amount !== 0 && txn.points_amount && (
                      <div style={{ fontSize: '11px', color: '#f59e0b' }}>{txn.points_amount > 0 ? '+' : ''}{txn.points_amount} pts</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

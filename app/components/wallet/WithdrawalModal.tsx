'use client';

import { useState, useEffect } from 'react';
import useMobile from '../useMobile';
import { useToast } from '../Toast';
import { useWithdrawal } from '@/lib/hooks/useWallet';
import { WALLET_CONSTANTS } from '@/types/wallet';
import { formatSGD } from '@/lib/paynow';
import type { Wallet } from '@/types/wallet';
import type { WithdrawalMethod } from '@/types/wallet';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  wallet: Wallet;
}

const QUICK_AMOUNTS = [50, 100, 200, 500];

export default function WithdrawalModal({ open, onClose, onSuccess, wallet }: Props) {
  const m = useMobile();
  const toast = useToast();
  const { requestWithdrawal, loading } = useWithdrawal();

  const [step, setStep] = useState<'form' | 'confirm' | 'success'>('form');
  const [amount, setAmount] = useState<number | ''>('');
  const [method, setMethod] = useState<WithdrawalMethod>('paynow');

  useEffect(() => {
    if (open) {
      setStep('form');
      setAmount('');
      setMethod(wallet.preferred_withdrawal || 'paynow');
    }
  }, [open, wallet.preferred_withdrawal]);

  const fee = WALLET_CONSTANTS.PROCESSING_FEES[method] ?? 0;
  const netAmount = Number(amount) ? Math.round((Number(amount) - fee) * 100) / 100 : 0;
  const hasPaynow = !!wallet.paynow_number;
  const hasBank = !!(wallet.bank_name && wallet.bank_account_number);

  const handleMax = () => {
    const max = Math.min(wallet.balance, WALLET_CONSTANTS.MAX_WITHDRAWAL);
    setAmount(max);
  };

  const handleContinue = () => {
    const num = Number(amount);
    if (!num || num < WALLET_CONSTANTS.MIN_WITHDRAWAL) {
      toast.error(`Minimum withdrawal is ${formatSGD(WALLET_CONSTANTS.MIN_WITHDRAWAL)}`);
      return;
    }
    if (num > wallet.balance) {
      toast.error('Insufficient balance');
      return;
    }
    if (num > WALLET_CONSTANTS.MAX_WITHDRAWAL) {
      toast.error(`Maximum withdrawal is ${formatSGD(WALLET_CONSTANTS.MAX_WITHDRAWAL)}`);
      return;
    }
    if (method === 'paynow' && !hasPaynow) {
      toast.error('Please set up your PayNow number in Settings first');
      return;
    }
    if (method === 'bank_transfer' && !hasBank) {
      toast.error('Please set up your bank account in Settings first');
      return;
    }
    setStep('confirm');
  };

  const handleSubmit = async () => {
    const result = await requestWithdrawal(Number(amount), method);
    if (result) {
      setStep('success');
    }
  };

  if (!open) return null;

  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: m ? 'flex-end' : 'center',
    justifyContent: 'center',
    padding: m ? '0' : '20px',
  };

  const modal: React.CSSProperties = {
    background: 'white',
    borderRadius: m ? '20px 20px 0 0' : '20px',
    padding: '28px 24px',
    maxWidth: '480px',
    width: '100%',
    maxHeight: m ? '90vh' : '85vh',
    overflowY: 'auto',
    boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
  };

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
            {step === 'form' ? 'Withdraw Funds' : step === 'confirm' ? 'Confirm Withdrawal' : 'Withdrawal Requested'}
          </h3>
          <div onClick={onClose} style={{ cursor: 'pointer', fontSize: '20px', color: '#94a3b8', lineHeight: 1 }}>✕</div>
        </div>

        {/* Step: Form */}
        {step === 'form' && (
          <>
            {/* Available balance */}
            <div style={{
              background: '#f8fafc',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Available Balance</span>
              <span style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>{formatSGD(wallet.balance)}</span>
            </div>

            {/* Quick amounts */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAmount(a)}
                  disabled={a > wallet.balance}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '10px',
                    border: amount === a ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                    background: amount === a ? '#eff6ff' : a > wallet.balance ? '#f8fafc' : 'white',
                    color: a > wallet.balance ? '#cbd5e1' : amount === a ? '#1d4ed8' : '#374151',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: a > wallet.balance ? 'not-allowed' : 'pointer',
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  ${a}
                </button>
              ))}
              <button
                onClick={handleMax}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#64748b',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Max
              </button>
            </div>

            {/* Amount input */}
            <div style={{ position: 'relative', marginBottom: '24px' }}>
              <span style={{
                position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                fontSize: '16px', fontWeight: '700', color: '#64748b',
              }}>$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
                placeholder="Enter amount"
                style={{
                  width: '100%',
                  padding: '14px 16px 14px 32px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1e293b',
                  outline: 'none',
                  fontFamily: "'Inter', sans-serif",
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Method selection */}
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '10px' }}>Withdrawal Method</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {/* PayNow */}
              <button
                onClick={() => setMethod('paynow')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
                  borderRadius: '12px',
                  border: method === 'paynow' ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                  background: method === 'paynow' ? '#faf5ff' : 'white',
                  cursor: 'pointer', textAlign: 'left', fontFamily: "'Inter', sans-serif",
                }}
              >
                <span style={{ fontSize: '24px' }}>🇸🇬</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>PayNow</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {hasPaynow ? `•••• ${wallet.paynow_number!.slice(-4)}` : 'Not set up'}
                    {' · Free · 1-2 business days'}
                  </div>
                </div>
                <span style={{
                  fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px',
                  background: '#ecfdf5', color: '#059669',
                }}>Free</span>
              </button>

              {/* Bank Transfer */}
              <button
                onClick={() => setMethod('bank_transfer')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
                  borderRadius: '12px',
                  border: method === 'bank_transfer' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  background: method === 'bank_transfer' ? '#eff6ff' : 'white',
                  cursor: 'pointer', textAlign: 'left', fontFamily: "'Inter', sans-serif",
                }}
              >
                <span style={{ fontSize: '24px' }}>🏦</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>Bank Transfer</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {hasBank ? `${wallet.bank_name} •••• ${wallet.bank_account_number!.slice(-4)}` : 'Not set up'}
                    {' · $0.50 fee · 1-3 business days'}
                  </div>
                </div>
                <span style={{
                  fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px',
                  background: '#fef3c7', color: '#92400e',
                }}>$0.50</span>
              </button>
            </div>

            {/* Warning if no method set up */}
            {((method === 'paynow' && !hasPaynow) || (method === 'bank_transfer' && !hasBank)) && (
              <div style={{
                padding: '12px 14px', background: '#fef3c7', borderRadius: '10px',
                marginBottom: '20px', fontSize: '13px', color: '#92400e', fontWeight: '500',
              }}>
                ⚠️ Please set up your {method === 'paynow' ? 'PayNow number' : 'bank account'} in Wallet Settings before withdrawing.
              </div>
            )}

            <button
              onClick={handleContinue}
              disabled={!amount || loading}
              style={{
                width: '100%', padding: '15px', borderRadius: '12px', border: 'none',
                background: amount ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : '#e2e8f0',
                color: amount ? 'white' : '#94a3b8',
                fontSize: '16px', fontWeight: '700',
                cursor: amount && !loading ? 'pointer' : 'not-allowed',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Continue
            </button>
          </>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && (
          <>
            <div style={{
              background: '#f8fafc', borderRadius: '14px', padding: '18px',
              marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '14px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', color: '#64748b' }}>Withdrawal Amount</span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>{formatSGD(Number(amount))}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', color: '#64748b' }}>Processing Fee</span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: fee > 0 ? '#f59e0b' : '#10b981' }}>
                  {fee > 0 ? formatSGD(fee) : 'Free'}
                </span>
              </div>
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>You will receive</span>
                <span style={{ fontSize: '18px', fontWeight: '800', color: '#10b981' }}>{formatSGD(netAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', color: '#64748b' }}>Method</span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
                  {method === 'paynow' ? `PayNow (${wallet.paynow_number})` : `${wallet.bank_name} •••• ${wallet.bank_account_number?.slice(-4)}`}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', color: '#64748b' }}>Estimated Arrival</span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
                  {method === 'paynow' ? '1-2' : '1-3'} business days
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setStep('form')}
                style={{
                  flex: 1, padding: '14px', borderRadius: '12px',
                  border: '1px solid #e2e8f0', background: 'white',
                  color: '#64748b', fontSize: '15px', fontWeight: '600',
                  cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                }}
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  flex: 1, padding: '14px', borderRadius: '12px', border: 'none',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: 'white', fontSize: '15px', fontWeight: '700',
                  cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Inter', sans-serif",
                }}
              >
                {loading ? 'Processing...' : 'Confirm Withdrawal'}
              </button>
            </div>
          </>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', fontSize: '32px',
            }}>✓</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>
              Withdrawal Requested!
            </div>
            <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
              {formatSGD(netAmount)} will be sent to your {method === 'paynow' ? 'PayNow' : 'bank'} account
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '24px' }}>
              Estimated arrival: {method === 'paynow' ? '1-2' : '1-3'} business days
            </div>
            <button
              onClick={() => { onSuccess(); onClose(); }}
              style={{
                width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white', fontSize: '15px', fontWeight: '700',
                cursor: 'pointer', fontFamily: "'Inter', sans-serif",
              }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

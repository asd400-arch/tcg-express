'use client';

import { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import useMobile from '../useMobile';
import { useToast } from '../Toast';
import { useTopup } from '@/lib/hooks/useWallet';
import { WALLET_CONSTANTS } from '@/types/wallet';
import { formatSGD } from '@/lib/paynow';
import type { TopupPaymentMethod } from '@/types/wallet';
import type { PayNowQRData } from '@/types/wallet';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialAmount?: string;
}

const QUICK_AMOUNTS = [20, 50, 100, 200, 500, 1000];

const TOPUP_BONUSES: Record<number, { amount: number; label: string }> = {
  500: { amount: 25, label: '+$25 bonus (5%)' },
  1000: { amount: 75, label: '+$75 bonus (7.5%)' },
};

function getBonusForAmount(amt: number): { amount: number; label: string } | null {
  if (amt >= 1000) return TOPUP_BONUSES[1000];
  if (amt >= 500) return TOPUP_BONUSES[500];
  return null;
}

export default function TopupModal({ open, onClose, onSuccess, initialAmount }: Props) {
  const m = useMobile();
  const toast = useToast();
  const { createTopup, loading } = useTopup();

  const [step, setStep] = useState<'amount' | 'qr' | 'success'>('amount');
  const [amount, setAmount] = useState<number | ''>('');
  const [method, setMethod] = useState<TopupPaymentMethod>('paynow');
  const [qrData, setQrData] = useState<PayNowQRData | null>(null);
  const [qrString, setQrString] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [qrLoading, setQrLoading] = useState(false);

  const numAmount = useMemo(() => (amount === '' ? 0 : Number(amount)), [amount]);

  // Reset state on open
  useEffect(() => {
    if (open) {
      setStep('amount');
      setAmount(initialAmount ? Math.max(10, Math.ceil(parseFloat(initialAmount))) : '');
      setMethod('paynow');
      setQrData(null);
      setQrString('');
      setReferenceId('');
    }
  }, [open]);

  // Generate a short client reference (<=25 chars)
  const makeReference = () => {
    const t = Date.now().toString(36).toUpperCase();
    const r = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `TOPUP${t}${r}`.slice(0, 25);
  };

  // Prefetch dynamic PayNow QR string when amount is selected (PayNow only)
  useEffect(() => {
    if (!open) return;
    if (method !== 'paynow') return;
    if (!numAmount) return;
    if (numAmount < WALLET_CONSTANTS.MIN_TOPUP || numAmount > WALLET_CONSTANTS.MAX_TOPUP) return;

    const ref = referenceId || makeReference();
    if (!referenceId) setReferenceId(ref);

    const controller = new AbortController();
    setQrLoading(true);

    fetch(`/api/wallet/paynow-qr?amount=${encodeURIComponent(numAmount)}&reference=${encodeURIComponent(ref)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to generate PayNow QR');
        setQrString(data.qrString || '');
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return;
        setQrString('');
      })
      .finally(() => setQrLoading(false));

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, method, numAmount]);

  // Countdown timer for QR expiry
  useEffect(() => {
    if (!qrData?.expiry) return;
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(qrData.expiry).getTime() - Date.now()) / 1000));
      setTimeLeft(diff);
      if (diff <= 0) setStep('amount');
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [qrData]);

  const handleSubmit = async () => {
    if (!numAmount || numAmount < WALLET_CONSTANTS.MIN_TOPUP || numAmount > WALLET_CONSTANTS.MAX_TOPUP) {
      toast.error(`Amount must be between ${formatSGD(WALLET_CONSTANTS.MIN_TOPUP)} and ${formatSGD(WALLET_CONSTANTS.MAX_TOPUP)}`);
      return;
    }

    const ref = method === 'paynow' ? (referenceId || makeReference()).slice(0, 25) : '';
    if (method === 'paynow' && !referenceId) setReferenceId(ref);

    if (method === 'paynow') {
      // Ensure we have a QR string (prefetch may have failed)
      let effectiveQrString = qrString;
      if (!effectiveQrString) {
        try {
          setQrLoading(true);
          const res = await fetch(`/api/wallet/paynow-qr?amount=${encodeURIComponent(numAmount)}&reference=${encodeURIComponent(ref)}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to generate PayNow QR');
          effectiveQrString = data.qrString || '';
          setQrString(effectiveQrString);
        } catch (e: any) {
          toast.error(e?.message || 'Failed to generate PayNow QR');
          return;
        } finally {
          setQrLoading(false);
        }
      }
    }

    const result = await createTopup(numAmount, method, method === 'paynow' ? ref : undefined);
    if (!result) return;

    if (method === 'paynow' && result.paynow_qr) {
      setQrData(result.paynow_qr);
      setStep('qr');
    } else if (method === 'stripe_card' && result.client_secret) {
      // Stripe card flow handled externally
      setStep('success');
      onSuccess();
    }
  };

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
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
            {step === 'amount' ? 'Top Up Wallet' : step === 'qr' ? 'Scan to Pay' : 'Top Up Successful'}
          </h3>
          <div onClick={onClose} style={{ cursor: 'pointer', fontSize: '20px', color: '#94a3b8', lineHeight: 1 }}>✕</div>
        </div>

        {/* Step: Amount */}
        {step === 'amount' && (
          <>
            {/* Quick amounts */}
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '10px' }}>Quick Amount</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {QUICK_AMOUNTS.map((a) => {
                const bonus = TOPUP_BONUSES[a];
                return (
                  <button
                    key={a}
                    onClick={() => setAmount(a)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '10px',
                      border: amount === a ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                      background: amount === a ? '#eff6ff' : 'white',
                      color: amount === a ? '#1d4ed8' : '#374151',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontFamily: "'Inter', sans-serif",
                      position: 'relative',
                    }}
                  >
                    {formatSGD(a)}
                    {bonus && (
                      <span style={{
                        display: 'block',
                        fontSize: '10px',
                        fontWeight: '700',
                        color: '#10b981',
                        marginTop: '2px',
                      }}>
                        {bonus.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Custom amount */}
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>Custom Amount</div>
            <div style={{ position: 'relative', marginBottom: '24px' }}>
              <span style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '16px',
                fontWeight: '700',
                color: '#64748b',
              }}>$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
                placeholder="Enter amount"
                min={WALLET_CONSTANTS.MIN_TOPUP}
                max={WALLET_CONSTANTS.MAX_TOPUP}
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

            {/* Payment method */}
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '10px' }}>Payment Method</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {/* PayNow */}
              <button
                onClick={() => setMethod('paynow')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: method === 'paynow' ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                  background: method === 'paynow' ? '#faf5ff' : 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                <span style={{ fontSize: '24px' }}>🇸🇬</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>PayNow</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Scan QR with banking app</div>
                </div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: '#ecfdf5',
                  color: '#059669',
                }}>Free</span>
              </button>

              {/* Card — temporarily disabled */}
              <button
                disabled
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  cursor: 'not-allowed',
                  textAlign: 'left',
                  fontFamily: "'Inter', sans-serif",
                  opacity: 0.6,
                }}
              >
                <span style={{ fontSize: '24px' }}>💳</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#94a3b8' }}>Credit / Debit Card</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Card payments coming soon</div>
                </div>
              </button>
            </div>

            {/* Bonus banner */}
            {amount && getBonusForAmount(Number(amount)) && (
              <div style={{
                background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
                borderRadius: '12px',
                padding: '12px 16px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                border: '1px solid #a7f3d0',
              }}>
                <span style={{ fontSize: '20px' }}>🎁</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#059669' }}>
                    Bonus Credit! {getBonusForAmount(Number(amount))!.label}
                  </div>
                  <div style={{ fontSize: '12px', color: '#047857' }}>
                    You'll receive {formatSGD(Number(amount) + getBonusForAmount(Number(amount))!.amount)} total
                  </div>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!amount || loading}
              style={{
                width: '100%',
                padding: '15px',
                borderRadius: '12px',
                border: 'none',
                background: amount ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : '#e2e8f0',
                color: amount ? 'white' : '#94a3b8',
                fontSize: '16px',
                fontWeight: '700',
                cursor: amount && !loading ? 'pointer' : 'not-allowed',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {loading ? 'Processing...' : amount
                ? `Top Up ${formatSGD(Number(amount))}${getBonusForAmount(Number(amount)) ? ' + ' + getBonusForAmount(Number(amount))!.label : ''}`
                : 'Enter Amount'}
            </button>
          </>
        )}

        {/* Step: QR Code */}
        {step === 'qr' && qrData && (
          <div style={{ textAlign: 'center' }}>
            {/* QR Code */}
            <div style={{
              width: '280px',
              height: '280px',
              margin: '0 auto 20px',
              borderRadius: '16px',
              background: 'white',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {qrLoading ? (
                <div style={{ color: '#64748b', fontWeight: 600, fontSize: '14px' }}>Generating QR…</div>
              ) : (
                <QRCodeSVG value={qrString || qrData.qr_string} size={200} />
              )}
            </div>

            {/* Amount */}
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#1e293b', marginBottom: '4px' }}>
              {formatSGD(qrData.amount)}
            </div>

            {/* Timer */}
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: timeLeft < 300 ? '#ef4444' : '#f59e0b',
              marginBottom: '16px',
            }}>
              ⏱ Expires in {formatTime(timeLeft)}
            </div>

            {/* Details */}
            <div style={{
              background: '#f8fafc',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '20px',
              textAlign: 'left',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>UEN</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{qrData.uen}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Recipient</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{qrData.recipient_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Reference</span>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#7c3aed', fontFamily: 'monospace' }}>{qrData.reference}</span>
              </div>
            </div>

            {/* Instructions */}
            <div style={{
              background: '#faf5ff',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '20px',
              textAlign: 'left',
            }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#7c3aed', marginBottom: '8px' }}>
                Scan with any Singapore banking app
              </div>
              <div style={{ fontSize: '12px', color: '#6b21a8', lineHeight: '1.6' }}>
                1. Open your banking app and choose PayNow / Scan<br />
                2. Scan this QR code and confirm the amount<br />
                3. After payment, keep the reference number for verification
              </div>
            </div>

            <button
              onClick={() => { setStep('amount'); }}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                background: 'white',
                color: '#64748b',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Back
            </button>
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#ecfdf5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: '32px',
            }}>✓</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>Top Up Successful!</div>
            <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>
              {formatSGD(Number(amount))} has been added to your wallet
              {getBonusForAmount(Number(amount)) && (
                <div style={{ color: '#10b981', fontWeight: '600', marginTop: '4px' }}>
                  🎁 {getBonusForAmount(Number(amount))!.label} will be credited shortly
                </div>
              )}
            </div>
            <button
              onClick={() => { onSuccess(); onClose(); }}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white',
                fontSize: '15px',
                fontWeight: '700',
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
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

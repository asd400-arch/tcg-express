'use client';

import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
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
}

const QUICK_AMOUNTS = WALLET_CONSTANTS.TOPUP_AMOUNTS_QUICK;

export default function TopupModal({ open, onClose, onSuccess }: Props) {
  const m = useMobile();
  const toast = useToast();
  const { createTopup, loading } = useTopup();

  const [step, setStep] = useState<'amount' | 'qr' | 'success'>('amount');
  const [amount, setAmount] = useState<number | ''>('');
  const [method, setMethod] = useState<TopupPaymentMethod>('paynow');
  const [qrData, setQrData] = useState<PayNowQRData | null>(null);
  const [qrImage, setQrImage] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);

  // Reset state on open
  useEffect(() => {
    if (open) {
      setStep('amount');
      setAmount('');
      setMethod('paynow');
      setQrData(null);
      setQrImage('');
    }
  }, [open]);

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

  // Generate QR image
  const generateQRImage = useCallback(async (data: string) => {
    try {
      const url = await QRCode.toDataURL(data, {
        width: 280,
        margin: 2,
        color: { dark: '#7c3aed', light: '#ffffff' },
      });
      setQrImage(url);
    } catch {
      setQrImage('');
    }
  }, []);

  const handleSubmit = async () => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount < WALLET_CONSTANTS.MIN_TOPUP || numAmount > WALLET_CONSTANTS.MAX_TOPUP) {
      toast.error(`Amount must be between ${formatSGD(WALLET_CONSTANTS.MIN_TOPUP)} and ${formatSGD(WALLET_CONSTANTS.MAX_TOPUP)}`);
      return;
    }

    const result = await createTopup(numAmount, method);
    if (!result) return;

    if (method === 'paynow' && result.paynow_qr) {
      setQrData(result.paynow_qr);
      await generateQRImage(result.paynow_qr.qr_string);
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
              {QUICK_AMOUNTS.map((a) => (
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
                  }}
                >
                  {formatSGD(a)}
                </button>
              ))}
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

              {/* Card */}
              <button
                onClick={() => setMethod('stripe_card')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: method === 'stripe_card' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  background: method === 'stripe_card' ? '#eff6ff' : 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                <span style={{ fontSize: '24px' }}>💳</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>Credit / Debit Card</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Visa, Mastercard, Amex</div>
                </div>
              </button>
            </div>

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
              {loading ? 'Processing...' : amount ? `Top Up ${formatSGD(Number(amount))}` : 'Enter Amount'}
            </button>
          </>
        )}

        {/* Step: QR Code */}
        {step === 'qr' && qrData && (
          <div style={{ textAlign: 'center' }}>
            {/* QR Image */}
            {qrImage && (
              <div style={{ marginBottom: '20px' }}>
                <img
                  src={qrImage}
                  alt="PayNow QR"
                  style={{ width: '280px', height: '280px', margin: '0 auto', borderRadius: '16px' }}
                />
              </div>
            )}

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
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#7c3aed', marginBottom: '8px' }}>How to pay</div>
              <div style={{ fontSize: '12px', color: '#6b21a8', lineHeight: '1.6' }}>
                1. Open your banking app (DBS, OCBC, UOB, etc.)<br />
                2. Tap on PayNow / Scan &amp; Pay<br />
                3. Scan this QR code<br />
                4. Verify the amount and confirm payment<br />
                5. Your wallet will be credited automatically
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

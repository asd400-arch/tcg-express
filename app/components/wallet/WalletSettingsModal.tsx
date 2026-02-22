'use client';

import { useState, useEffect } from 'react';
import useMobile from '../useMobile';
import { useToast } from '../Toast';
import { useWalletSettings } from '@/lib/hooks/useWallet';
import { SG_BANKS } from '@/types/wallet';
import type { Wallet, PayNowType } from '@/types/wallet';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  wallet: Wallet;
}

const PAYNOW_TYPES: { value: PayNowType; label: string }[] = [
  { value: 'phone', label: 'Phone' },
  { value: 'uen', label: 'UEN' },
  { value: 'nric', label: 'NRIC' },
];

const PAYNOW_PLACEHOLDERS: Record<PayNowType, string> = {
  phone: '+65 9XXX XXXX',
  uen: 'e.g. 202600001A',
  nric: 'e.g. S1234567D',
};

export default function WalletSettingsModal({ open, onClose, onSuccess, wallet }: Props) {
  const m = useMobile();
  const toast = useToast();
  const { updateSettings, loading } = useWalletSettings();

  const [tab, setTab] = useState<'paynow' | 'bank'>('paynow');
  const [paynowType, setPaynowType] = useState<PayNowType>(wallet.paynow_type || 'phone');
  const [paynowNumber, setPaynowNumber] = useState(wallet.paynow_number || '');
  const [bankName, setBankName] = useState(wallet.bank_name || '');
  const [bankAccount, setBankAccount] = useState(wallet.bank_account_number || '');
  const [bankHolder, setBankHolder] = useState(wallet.bank_account_holder || '');

  useEffect(() => {
    if (open) {
      setPaynowType(wallet.paynow_type || 'phone');
      setPaynowNumber(wallet.paynow_number || '');
      setBankName(wallet.bank_name || '');
      setBankAccount(wallet.bank_account_number || '');
      setBankHolder(wallet.bank_account_holder || '');
    }
  }, [open, wallet]);

  const handleSave = async () => {
    if (tab === 'paynow') {
      if (!paynowNumber.trim()) {
        toast.error('Please enter your PayNow number');
        return;
      }
      const result = await updateSettings({
        paynow_type: paynowType,
        paynow_number: paynowNumber.trim(),
        preferred_withdrawal: 'paynow',
      });
      if (result) {
        toast.success('PayNow settings saved');
        onSuccess();
        onClose();
      }
    } else {
      if (!bankName || !bankAccount.trim() || !bankHolder.trim()) {
        toast.error('Please fill in all bank details');
        return;
      }
      const result = await updateSettings({
        bank_name: bankName,
        bank_account_number: bankAccount.trim(),
        bank_account_holder: bankHolder.trim(),
        preferred_withdrawal: 'bank_transfer',
      });
      if (result) {
        toast.success('Bank details saved');
        onSuccess();
        onClose();
      }
    }
  };

  if (!open) return null;

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: m ? 'flex-end' : 'center', justifyContent: 'center',
    padding: m ? '0' : '20px',
  };

  const modal: React.CSSProperties = {
    background: 'white', borderRadius: m ? '20px 20px 0 0' : '20px',
    padding: '28px 24px', maxWidth: '480px', width: '100%',
    maxHeight: m ? '90vh' : '85vh', overflowY: 'auto', boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '13px 16px', borderRadius: '12px',
    border: '1px solid #e2e8f0', background: '#f8fafc',
    fontSize: '14px', fontWeight: '500', color: '#1e293b',
    outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block',
  };

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Withdrawal Settings</h3>
          <div onClick={onClose} style={{ cursor: 'pointer', fontSize: '20px', color: '#94a3b8', lineHeight: 1 }}>✕</div>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'flex', background: '#f1f5f9', borderRadius: '12px', padding: '4px', marginBottom: '24px',
        }}>
          {(['paynow', 'bank'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                background: tab === t ? 'white' : 'transparent',
                color: tab === t ? '#1e293b' : '#64748b',
                fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {t === 'paynow' ? '🇸🇬 PayNow' : '🏦 Bank Account'}
            </button>
          ))}
        </div>

        {/* PayNow tab */}
        {tab === 'paynow' && (
          <>
            {/* Type selector */}
            <label style={labelStyle}>PayNow Type</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {PAYNOW_TYPES.map((pt) => (
                <button
                  key={pt.value}
                  onClick={() => setPaynowType(pt.value)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '10px',
                    border: paynowType === pt.value ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                    background: paynowType === pt.value ? '#faf5ff' : 'white',
                    color: paynowType === pt.value ? '#7c3aed' : '#374151',
                    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {pt.label}
                </button>
              ))}
            </div>

            {/* Number input */}
            <label style={labelStyle}>PayNow Number</label>
            <input
              type="text"
              value={paynowNumber}
              onChange={(e) => setPaynowNumber(e.target.value)}
              placeholder={PAYNOW_PLACEHOLDERS[paynowType]}
              style={{ ...inputStyle, marginBottom: '16px' }}
            />

            {/* Info box */}
            <div style={{
              padding: '14px', background: '#faf5ff', borderRadius: '12px',
              marginBottom: '24px', fontSize: '13px', color: '#6b21a8', lineHeight: '1.5',
            }}>
              💡 PayNow withdrawals are <strong>free</strong> and typically processed within 1-2 business days.
            </div>
          </>
        )}

        {/* Bank tab */}
        {tab === 'bank' && (
          <>
            {/* Bank selector */}
            <label style={labelStyle}>Bank</label>
            <select
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              style={{ ...inputStyle, marginBottom: '16px', appearance: 'auto' as any }}
            >
              <option value="">Select your bank</option>
              {SG_BANKS.map((bank) => (
                <option key={bank.code} value={bank.name}>{bank.name}</option>
              ))}
            </select>

            {/* Account number */}
            <label style={labelStyle}>Account Number</label>
            <input
              type="text"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              placeholder="e.g. 123-456789-0"
              style={{ ...inputStyle, marginBottom: '16px' }}
            />

            {/* Account holder */}
            <label style={labelStyle}>Account Holder Name</label>
            <input
              type="text"
              value={bankHolder}
              onChange={(e) => setBankHolder(e.target.value)}
              placeholder="As shown on bank statement"
              style={{ ...inputStyle, marginBottom: '16px' }}
            />

            {/* Info box */}
            <div style={{
              padding: '14px', background: '#eff6ff', borderRadius: '12px',
              marginBottom: '24px', fontSize: '13px', color: '#1e40af', lineHeight: '1.5',
            }}>
              💡 Bank transfers have a <strong>$0.50 processing fee</strong> and take 1-3 business days.
            </div>
          </>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={loading}
          style={{
            width: '100%', padding: '15px', borderRadius: '12px', border: 'none',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            color: 'white', fontSize: '16px', fontWeight: '700',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

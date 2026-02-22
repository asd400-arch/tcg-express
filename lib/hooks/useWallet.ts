'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  WalletOverview,
  WalletTransaction,
  TopupResponse,
  WalletWithdrawal,
  Wallet,
  TopupPaymentMethod,
  WithdrawalMethod,
} from '@/types/wallet';

// ============================================================
// 1. useWallet — Fetch wallet overview
// ============================================================

export function useWallet() {
  const [data, setData] = useState<WalletOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/wallet');
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to fetch wallet');
      setData(result.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

// ============================================================
// 2. useTransactionHistory — Paginated transaction list
// ============================================================

export function useTransactionHistory(type?: string) {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (type) params.set('type', type);

      const res = await fetch(`/api/wallet/transactions?${params}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to fetch transactions');
      setTransactions(result.data.transactions);
      setTotal(result.data.total);
    } catch {
      setTransactions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, type]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const totalPages = Math.ceil(total / limit);

  return { transactions, total, page, setPage, loading, refetch, totalPages };
}

// ============================================================
// 3. useTopup — Create top-up (PayNow or Stripe)
// ============================================================

export function useTopup() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTopup = useCallback(
    async (amount: number, paymentMethod: TopupPaymentMethod): Promise<TopupResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/wallet/topup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, payment_method: paymentMethod }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to create top-up');
        return result.data as TopupResponse;
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createTopup, loading, error };
}

// ============================================================
// 4. useWithdrawal — Request withdrawal
// ============================================================

export function useWithdrawal() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestWithdrawal = useCallback(
    async (
      amount: number,
      method: WithdrawalMethod
    ): Promise<WalletWithdrawal | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/wallet/withdrawal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, method }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to request withdrawal');
        return result.data as WalletWithdrawal;
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { requestWithdrawal, loading, error };
}

// ============================================================
// 5. useWalletSettings — Update bank/PayNow settings
// ============================================================

export function useWalletSettings() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateSettings = useCallback(
    async (settings: {
      bank_name?: string;
      bank_account_number?: string;
      bank_account_holder?: string;
      paynow_number?: string;
      paynow_type?: 'phone' | 'uen' | 'nric';
      preferred_withdrawal?: WithdrawalMethod;
    }): Promise<Wallet | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/wallet', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to update settings');
        return result.data as Wallet;
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { updateSettings, loading, error };
}

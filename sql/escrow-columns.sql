-- Phase 9: Escrow columns for express_transactions
-- Run this in Supabase SQL Editor

ALTER TABLE express_transactions
  ADD COLUMN IF NOT EXISTS held_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

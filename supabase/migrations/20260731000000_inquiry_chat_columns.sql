-- ==========================================================================
-- Migration: inquiry chat support (D-1)
-- Requires: PostgreSQL 15+ (NULLS NOT DISTINCT)
-- ==========================================================================
BEGIN;

-- 1. chat_messages: add columns ──────────────────────────────────────────
ALTER TABLE chat_messages
  ADD COLUMN driver_id   uuid REFERENCES express_users(id),
  ADD COLUMN thread_type text NOT NULL DEFAULT 'job_chat';

ALTER TABLE chat_messages
  ADD CONSTRAINT chk_thread_type
    CHECK (thread_type IN ('inquiry', 'job_chat'));

ALTER TABLE chat_messages
  ADD CONSTRAINT chk_inquiry_requires_driver
    CHECK (thread_type <> 'inquiry' OR driver_id IS NOT NULL);

-- 2. Backfill existing rows ──────────────────────────────────────────────
UPDATE chat_messages cm
SET    driver_id = ej.assigned_driver_id
FROM   express_jobs ej
WHERE  cm.job_id = ej.id
  AND  cm.driver_id IS NULL;

-- 3. Index for inquiry threads ───────────────────────────────────────────
CREATE INDEX idx_chat_messages_inquiry
  ON chat_messages (job_id, driver_id, created_at)
  WHERE thread_type = 'inquiry';

-- 4. job_chat_reads: add driver_id + UNIQUE NULLS NOT DISTINCT ───────────
ALTER TABLE job_chat_reads
  ADD COLUMN driver_id uuid REFERENCES express_users(id);

ALTER TABLE job_chat_reads
  DROP CONSTRAINT job_chat_reads_pkey;

ALTER TABLE job_chat_reads
  ADD CONSTRAINT job_chat_reads_uniq
  UNIQUE NULLS NOT DISTINCT (job_id, user_id, driver_id);

ALTER TABLE job_chat_reads
  ADD COLUMN id uuid DEFAULT gen_random_uuid() NOT NULL;

ALTER TABLE job_chat_reads
  ADD CONSTRAINT job_chat_reads_pkey PRIMARY KEY (id);

COMMIT;

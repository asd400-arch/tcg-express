-- ============================================================
-- Add UPDATE policy for support_tickets
-- Allows ticket owners to update satisfaction rating after resolution.
-- Admin/agent updates use supabaseAdmin (service_role) which bypasses RLS.
-- ============================================================

CREATE POLICY "tickets_update_satisfaction" ON support_tickets
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

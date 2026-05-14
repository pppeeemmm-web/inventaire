-- Web Share Target inbox (Ring B.3) — short-lived rows + R2 keys under share-inbox/<id>/...
-- Run in Supabase SQL Editor; then run grant_audit_queries.sql if audit flags gaps.

CREATE TABLE IF NOT EXISTS public.share_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  expires_at timestamptz NOT NULL,
  user_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_share_inbox_user_expires
  ON public.share_inbox (user_id, expires_at DESC);

COMMENT ON TABLE public.share_inbox IS 'PWA Web Share Target payloads; expires_at TTL (app default 24h). R2 keys in paintings bucket prefix share-inbox/.';

ALTER TABLE public.share_inbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "share_inbox_own_select" ON public.share_inbox;
CREATE POLICY "share_inbox_own_select"
  ON public.share_inbox
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND expires_at > timezone('utc', now()));

DROP POLICY IF EXISTS "share_inbox_own_insert" ON public.share_inbox;
CREATE POLICY "share_inbox_own_insert"
  ON public.share_inbox
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "share_inbox_own_delete" ON public.share_inbox;
CREATE POLICY "share_inbox_own_delete"
  ON public.share_inbox
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.share_inbox TO authenticated;

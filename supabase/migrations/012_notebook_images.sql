-- ============================================================
-- Migration 012 — Notebook images (AI-generated images saved per notebook)
-- ============================================================
-- Run this in Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- ── Table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notebook_images (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id  UUID        NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT        NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notebook_images_notebook
  ON notebook_images (notebook_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notebook_images_user
  ON notebook_images (user_id);

-- RLS: server uses the service role, so policies aren't strictly required,
-- but enable RLS to lock this table down for any future anon-key access.
ALTER TABLE notebook_images ENABLE ROW LEVEL SECURITY;

-- ── Storage bucket ───────────────────────────────────────────
-- Public bucket so saved images can be displayed without signed URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('notebook-images', 'notebook-images', true)
ON CONFLICT (id) DO NOTHING;

-- Only authenticated users can upload
CREATE POLICY "authenticated users can upload notebook images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'notebook-images');

-- Anyone can read (public bucket)
CREATE POLICY "public read access for notebook images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'notebook-images');

-- Uploaders can delete their own files (path is keyed by user id as first folder)
CREATE POLICY "uploaders can delete notebook images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'notebook-images' AND auth.uid()::text = (storage.foldername(name))[1]);

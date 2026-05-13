-- ============================================================
-- Scholr File Storage
-- Run this AFTER 001_schema.sql
-- ============================================================

-- Create the storage bucket (public so file URLs are shareable without signed URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('scholr-files', 'scholr-files', true)
ON CONFLICT (id) DO NOTHING;

-- Only authenticated users can upload
CREATE POLICY "authenticated users can upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'scholr-files');

-- Anyone can read (public bucket)
CREATE POLICY "public read access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'scholr-files');

-- Uploaders can delete their own files
CREATE POLICY "uploaders can delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'scholr-files' AND auth.uid()::text = (storage.foldername(name))[1]);

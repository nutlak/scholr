-- 028_public_sharing.sql
-- Public, read-only notebook sharing via a unique slug (scholr.dev/s/<slug>).
ALTER TABLE notebooks ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE notebooks ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_notebooks_public_slug ON notebooks(public_slug);

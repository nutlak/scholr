-- ============================================================
-- Migration 038 — remember that a class was built from a syllabus
-- ============================================================
-- Run in Supabase Dashboard > SQL Editor > New query.
--
-- The dashboard offers "Import syllabus" on every class row. Once a class
-- HAS been imported from its syllabus, the offer is noise, so the row needs
-- to know it already happened. Nullable: every existing class reads as
-- "never imported", which is the safe default — the button keeps showing.
--
-- The API tolerates this column not existing yet (it retries the classes
-- query without it), so deploying the code before running this is safe; the
-- button simply never hides until the column is there.
-- ============================================================

ALTER TABLE classes ADD COLUMN IF NOT EXISTS syllabus_imported_at TIMESTAMPTZ;

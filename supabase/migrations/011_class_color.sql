-- ============================================================
-- Migration 011 — Class color (idempotent reassertion)
-- ============================================================
-- The `color` column was already added in migration 004 (stores
-- a hex string like '#A78BFA'). This migration is a safety net
-- to make sure it exists with the expected shape and default,
-- and to make the column nullable-safe.
-- Run this in Supabase Dashboard > SQL Editor > New query.
-- ============================================================

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#A78BFA';

-- Backfill any NULLs from older rows
UPDATE classes
  SET color = '#A78BFA'
  WHERE color IS NULL OR color = '';

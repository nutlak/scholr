-- ============================================================
-- Migration 031 — Image-generation usage counter
-- ============================================================
-- Run this in Supabase Dashboard > SQL Editor > New query
-- Safe to re-run.
--
-- Adds the monthly image-generation counter to the existing `usage` table
-- (which already tracks messages_this_month / forge_outputs_this_month).
-- Meters POST /api/generate-image against the free tier (FREE_IMAGE_LIMIT).
-- ⚠ Run this BEFORE deploying the metering change so the column exists.
-- ============================================================

ALTER TABLE usage ADD COLUMN IF NOT EXISTS images_this_month INT DEFAULT 0;

-- ============================================================
-- Migration 032 — Date of birth / age gate (COPPA, minimum age 13)
-- ============================================================
-- Run this in Supabase Dashboard > SQL Editor > New query
-- Safe to re-run.
--
-- Adds the verified birthdate to the existing `profiles` table (where
-- username / last_active / terms_accepted_at already live). Collected at
-- signup; the server blocks under-13 before creating the account.
-- ⚠ Run this BEFORE deploying so the DOB save at signup has somewhere to land.
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth   DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMPTZ;

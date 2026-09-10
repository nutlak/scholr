-- ============================================================
-- Migration 033 — Presence context ("Ana is in Bio 101 right now")
-- ============================================================
-- Run this in Supabase Dashboard > SQL Editor > New query
-- Safe to re-run.
--
-- `profiles.last_active` already answers "is this friend online". This adds
-- what they are online *in*, which is the part that gets people studying
-- together instead of merely at the same time.
--
-- The server only ever reveals this notebook to a viewer who is themselves a
-- member of it, so the column leaking to a friend list cannot expose the
-- title of a notebook the viewer cannot already open.
--
-- Safe to deploy before or after the server: the heartbeat swallows the
-- "column does not exist" error and simply records last_active as before.
-- ============================================================

alter table public.profiles
  add column if not exists last_notebook_id uuid
  references public.notebooks(id) on delete set null;

comment on column public.profiles.last_notebook_id is
  'Notebook the user was last active in. Only exposed to viewers who share it.';

-- Presence is always read as "who is active recently", never scanned whole.
create index if not exists profiles_last_active_idx
  on public.profiles (last_active desc);

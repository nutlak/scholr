-- 023_podcasts_created_by_cascade.sql
--
-- Root-cause fix for "Failed to delete account" failures.
--
-- migration 019 created podcasts.created_by as:
--     created_by uuid NOT NULL REFERENCES auth.users(id)
-- i.e. WITHOUT "ON DELETE CASCADE" (every other auth.users FK in the schema —
-- profiles, terms_acceptances, subscriptions, usage — uses ON DELETE CASCADE).
--
-- Consequence: if a user authored a podcast in a notebook they do NOT own, that
-- podcast row is not covered by the notebook's ON DELETE CASCADE, so deleting the
-- user (DELETE FROM auth.users) raises a foreign-key violation and aborts account
-- deletion. The delete-account endpoint now also clears these rows in app code,
-- but recreating the constraint with ON DELETE CASCADE fixes it at the source and
-- protects any other path that deletes an auth user.
--
-- Idempotent and safe to run repeatedly. No-ops if the podcasts table does not
-- exist yet (migration 019 not run).

DO $$
DECLARE
  fk_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'podcasts'
  ) THEN
    RAISE NOTICE 'podcasts table does not exist yet; skipping cascade fix';
    RETURN;
  END IF;

  -- Find the existing created_by -> auth.users foreign key (name may vary).
  SELECT c.conname INTO fk_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'podcasts'
    AND c.contype = 'f'
    AND pg_get_constraintdef(c.oid) ILIKE '%(created_by)%auth.users%';

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE podcasts DROP CONSTRAINT %I', fk_name);
  END IF;

  ALTER TABLE podcasts
    ADD CONSTRAINT podcasts_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;

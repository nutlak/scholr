-- 030_notebook_cascades.sql
-- Ensure deleting a notebook cascades to its children, so nothing is orphaned
-- (notes, memberships, stars). Idempotent: recreates each notebook_id FK with
-- ON DELETE CASCADE. No-ops for any table that doesn't exist.

DO $$
DECLARE
  t       text;
  fk      text;
  tables  text[] := ARRAY['notes', 'notebook_members', 'starred_notebooks'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      RAISE NOTICE 'table % does not exist; skipping', t;
      CONTINUE;
    END IF;

    -- Find the existing notebook_id -> notebooks foreign key (name may vary).
    SELECT c.conname INTO fk
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    WHERE cl.relname = t
      AND c.contype = 'f'
      AND pg_get_constraintdef(c.oid) ILIKE '%(notebook_id)%notebooks%'
    LIMIT 1;

    IF fk IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t, fk);
    END IF;

    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE',
      t, t || '_notebook_id_fkey'
    );
  END LOOP;
END $$;

-- Deny-by-default RLS on every table in public.
--
-- The browser never queries a table: it uses Supabase only for auth and
-- realtime broadcast/presence (no postgres_changes anywhere). Every read and
-- write goes through the Express server on the service-role key, which
-- bypasses RLS. So the right posture is RLS on with no policy unless one is
-- deliberately wanted — that way anyone holding the public anon key (it ships
-- in the bundle) reads nothing.
--
-- Only 11 of the ~36 tables were created in migrations; the rest came from
-- the dashboard and their RLS state can't be reviewed from the repo. This
-- loops over pg_tables, so it covers those too. Existing policies (e.g. the
-- read-own rows from 027) are untouched — enabling RLS only removes access
-- that no policy grants.
--
-- Also revokes direct execution of get_user_id_by_email: the server calls it
-- as service_role, but if anon can call it, the public key becomes an
-- email → user-id lookup for anyone.
--
-- Run in Supabase Dashboard > SQL Editor. Safe to re-run.

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_user_id_by_email'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    -- service_role may only have had it via PUBLIC; keep the server's access (see 041).
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

-- Verify: should return zero rows.
select tablename from pg_tables
where schemaname = 'public' and not rowsecurity;

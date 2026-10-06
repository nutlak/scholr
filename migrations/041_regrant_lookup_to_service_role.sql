-- 040 revoked execute on get_user_id_by_email from public, anon and
-- authenticated. The server's service_role had only ever reached the function
-- through PUBLIC, so it lost access too: send-otp's account lookup started
-- failing, which read as "no such account" — password reset silently sent no
-- email. Grant it back to service_role explicitly.
--
-- Run in Supabase Dashboard > SQL Editor. Safe to re-run.

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_user_id_by_email'
  loop
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

-- Verify: should list service_role, and not anon or authenticated.
select grantee from information_schema.routine_privileges
where routine_schema = 'public' and routine_name = 'get_user_id_by_email';

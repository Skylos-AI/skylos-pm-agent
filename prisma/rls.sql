-- Skylos PM Agent — v1 RLS policies.
-- Run once via Supabase SQL editor after the initial Prisma migration.
--
-- Policy model: any authenticated team member can read and write every row.
-- The agent (OpenClaw) uses the service_role key and bypasses RLS entirely.
-- Per-row ownership / granular policies arrive after Phase 1.

do $$
declare
  t text;
begin
  for t in
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'users','personas','companies','contacts','projects',
        'tasks','activities','pipeline_deals','agent_log','reminders'
      )
  loop
    execute format('alter table %I enable row level security;', t);

    execute format($p$
      create policy "team_read_all" on %I for select
      using (auth.role() = 'authenticated');
    $p$, t);

    execute format($p$
      create policy "team_write_all" on %I for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
    $p$, t);
  end loop;
end $$;

-- Sanity check: should return 20 rows (2 policies × 10 tables).
-- select tablename, policyname from pg_policies
-- where schemaname = 'public'
-- order by tablename, policyname;

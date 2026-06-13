-- Skylos PM Agent — Postgres trigger to maintain updated_at.
-- Prisma's @updatedAt runs in client code only, so raw inserts/updates from
-- the Supabase JS client (the agent runtime path) leave updated_at NULL.
-- This script adds a DB-level default for inserts and a BEFORE UPDATE trigger
-- for updates so the column stays correct regardless of who's writing.
--
-- Run once via:
--   npx prisma db execute --file prisma/triggers.sql --schema prisma/schema.prisma

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'users','personas','companies','contacts','projects',
      'tasks','pipeline_deals','reminders'
    ])
  loop
    execute format('alter table %I alter column updated_at set default now();', t);
    execute format('drop trigger if exists tg_%I_updated_at on %I;', t, t);
    execute format(
      'create trigger tg_%I_updated_at before update on %I for each row execute function set_updated_at();',
      t, t
    );
  end loop;
end $$;

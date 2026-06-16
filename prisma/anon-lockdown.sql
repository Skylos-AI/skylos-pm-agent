-- Defense-in-depth: revoke all access from the anon role.
-- The Skylos PM web app uses Supabase Auth (magic-link) for all reads/writes;
-- the anon key is exposed to the browser by design but should not be able to
-- see public schema content. If the anon key + a JWT ever leak, the attacker
-- gets nothing.

revoke all on schema public from anon;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

-- Future-proof: any newly created object should default to no anon access.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

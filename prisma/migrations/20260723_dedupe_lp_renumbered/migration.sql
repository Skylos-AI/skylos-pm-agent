-- The second La Paz CSV (prospects_lp_60_by_channel.csv) renumbered the
-- external_ids for 12 companies that were already imported from the first
-- CSV (prospects_lp_verified.csv). Because the importer's idempotency key
-- is external_id, the renumbered rows didn't collide with the originals
-- and got imported a second time as visible duplicates in /companies.
--
-- Fix: drop the 12 OLD copies (their external_ids are effectively orphan
-- IDs from the superseded CSV). We keep the NEW copies because they:
--   - come from the current source-of-truth CSV's numbering
--   - carry the fresher preferred_channel / status values
--
-- Verified before delete that these 12 rows have no activities, projects,
-- deals, reminders, approvals, or WA sends — only their imported primary
-- contact, which cascades via the FK.
--
-- Idempotent: WHERE clause targets a specific set of external_ids and is
-- a no-op on re-run (the rows will already be gone).

DELETE FROM "companies"
 WHERE "external_id" IN (
   'prsp_lp_2026_004', -- IBRO S.R.L. (dup of _007)
   'prsp_lp_2026_011', -- GESTORES DE PAPELES CORPORATIVOS (dup of _010)
   'prsp_lp_2026_014', -- SKMTH (dup of _013)
   'prsp_lp_2026_025', -- DENTALNET (dup of _006)
   'prsp_lp_2026_030', -- IMPORTADORA KORTABACO (dup of _008)
   'prsp_lp_2026_036', -- JETSTAR CARGO LOGISTICS (dup of _016)
   'prsp_lp_2026_039', -- SMARTSOURCE (dup of _020)
   'prsp_lp_2026_043', -- MUNAIPATA CAFE (dup of _003)
   'prsp_lp_2026_049', -- INMOBILIARIA EL REMANSO (dup of _009)
   'prsp_lp_2026_053', -- NUÑEZ DEL PRADO ASOCIADOS (dup of _012)
   'prsp_lp_2026_054', -- EQSU (dup of _017)
   'prsp_lp_2026_058'  -- MORENO BALDIVIESO (dup of _018)
 );

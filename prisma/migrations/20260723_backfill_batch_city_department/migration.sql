-- Backfill city + department on the two prospect batches so the CRM's
-- Departamento / Ciudad filters actually show Cochabamba and La Paz.
-- In Bolivia both are simultaneously city and department (capital = same
-- name as its department), so we set both columns to the same value.
--
-- Scope is pinned to each batch's external_id prefix:
--   - "DB-%"       → Cochabamba batch (2026-06 outreach leads)
--   - "prsp_lp_%"  → La Paz batch (2026-07 verified prospects)
-- The COALESCE-style guards (city IS NULL / department IS NULL) make the
-- migration idempotent: a re-run touches nothing already filled in.

UPDATE "companies"
   SET "city" = COALESCE("city", 'Cochabamba'),
       "department" = COALESCE("department", 'Cochabamba')
 WHERE "external_id" LIKE 'DB-%';

UPDATE "companies"
   SET "department" = COALESCE("department", 'La Paz')
 WHERE "external_id" LIKE 'prsp_lp_%';

-- Add structured "specificity" fields to tasks so assignees know
-- exactly what they need (resources / links) and how big the work
-- is (estimated_hours). Both nullable so existing rows are unaffected.

ALTER TABLE "tasks"
  ADD COLUMN "estimated_hours" INTEGER,
  ADD COLUMN "resources" TEXT;

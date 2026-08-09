-- Task notes — append-only thread of comments attached to a task, each stamped
-- with the author (or flagged as agent-written). Author is nullable so an
-- account deletion does not destroy history; the row keeps its body and
-- author_agent flag.

CREATE TABLE "task_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "author_id" UUID,
    "author_agent" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_notes_task_id_created_at_idx"
  ON "task_notes"("task_id", "created_at" DESC);

ALTER TABLE "task_notes"
  ADD CONSTRAINT "task_notes_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_notes"
  ADD CONSTRAINT "task_notes_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS parity with the other v1 tables (see prisma/rls.sql): any authenticated
-- team member can read/write everything; the agent uses service_role and
-- bypasses RLS.
ALTER TABLE "task_notes" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_read_all" ON "task_notes" FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "team_write_all" ON "task_notes" FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

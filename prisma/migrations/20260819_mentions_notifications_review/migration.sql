-- Mentions, in-app notifications, and multi-reviewer task validation.
-- Additive only: one new enum value on TaskStatus, one new enum
-- (NotificationKind), and three tables (chat_mentions, notifications,
-- task_reviewers). RLS follows the v1 "any authenticated team member can
-- read/write" pattern. Realtime is enabled on notifications so the browser
-- can subscribe to postgres_changes for the bell badge.

-- AlterEnum: TaskStatus gains IN_REVIEW (used by the task review flow).
-- Postgres 12+ supports ALTER TYPE ... ADD VALUE inside a transaction only
-- when the enum was created in an earlier transaction, which is our case.
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'IN_REVIEW';

-- CreateEnum: NotificationKind
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationKind') THEN
    CREATE TYPE "NotificationKind" AS ENUM (
      'CHAT_MENTION',
      'TASK_ASSIGNED',
      'TASK_REVIEW_REQUESTED',
      'TASK_APPROVED',
      'TASK_REJECTED',
      'TASK_COMPLETED'
    );
  END IF;
END $$;

-- =====================================================================
-- chat_mentions
-- One row per @mention inside a chat message. Exactly one of
-- mentioned_user_id / mentioned_task_id is set (enforced by CHECK).
-- offset/length locate the mention in the message body so the client
-- can render a clickable pill without re-parsing.
-- =====================================================================
CREATE TABLE "chat_mentions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id" UUID NOT NULL,
    "mentioned_user_id" UUID,
    "mentioned_task_id" UUID,
    "offset" INTEGER NOT NULL,
    "length" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_mentions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_mentions_target_ck" CHECK (
      (("mentioned_user_id" IS NOT NULL)::int + ("mentioned_task_id" IS NOT NULL)::int) = 1
    )
);

CREATE INDEX "chat_mentions_message_id_idx" ON "chat_mentions"("message_id");
CREATE INDEX "chat_mentions_mentioned_user_id_idx" ON "chat_mentions"("mentioned_user_id");
CREATE INDEX "chat_mentions_mentioned_task_id_idx" ON "chat_mentions"("mentioned_task_id");

ALTER TABLE "chat_mentions"
  ADD CONSTRAINT "chat_mentions_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_mentions"
  ADD CONSTRAINT "chat_mentions_mentioned_user_id_fkey"
  FOREIGN KEY ("mentioned_user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_mentions"
  ADD CONSTRAINT "chat_mentions_mentioned_task_id_fkey"
  FOREIGN KEY ("mentioned_task_id") REFERENCES "tasks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================================
-- notifications
-- In-app notifications. `kind` explains why; optional foreign keys carry
-- the context so the UI can link back. All foreign keys are ON DELETE
-- SET NULL / CASCADE conservatively — the notification row stays useful
-- (the body carries the message) even if the source is later removed.
-- =====================================================================
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "body" TEXT NOT NULL,
    "source_message_id" UUID,
    "source_mention_id" UUID,
    "source_task_id" UUID,
    "source_user_id" UUID,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_user_id_read_at_created_at_idx"
  ON "notifications"("user_id", "read_at", "created_at" DESC);

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_source_mention_id_fkey"
  FOREIGN KEY ("source_mention_id") REFERENCES "chat_mentions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================================
-- task_reviewers
-- Multi-reviewer validation for tasks. When present, the task cannot
-- go straight to DONE; the assignee marks it done, it moves to
-- IN_REVIEW, and each reviewer must approve. When every row has
-- approved_at set, application code auto-transitions the task to DONE.
-- A rejection (rejected_at + comment) sends it back to IN_PROGRESS.
-- =====================================================================
CREATE TABLE "task_reviewers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_reviewers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "task_reviewers_task_id_user_id_key" UNIQUE ("task_id", "user_id")
);

CREATE INDEX "task_reviewers_user_id_approved_at_idx"
  ON "task_reviewers"("user_id", "approved_at");

ALTER TABLE "task_reviewers"
  ADD CONSTRAINT "task_reviewers_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_reviewers"
  ADD CONSTRAINT "task_reviewers_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================================
-- RLS parity with v1 (see prisma/rls.sql)
-- =====================================================================
ALTER TABLE "chat_mentions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_reviewers" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_read_all" ON "chat_mentions" FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "team_write_all" ON "chat_mentions" FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "team_read_all" ON "notifications" FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "team_write_all" ON "notifications" FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "team_read_all" ON "task_reviewers" FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "team_write_all" ON "task_reviewers" FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- =====================================================================
-- Realtime: browser subscribes to postgres_changes on notifications to
-- update the bell badge in real time. Idempotent.
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

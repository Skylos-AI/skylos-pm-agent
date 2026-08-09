-- Team chat — DMs and group channels for the 3-person team.
-- Additive only: one enum, three tables, RLS in the "any authenticated
-- team member can read/write" pattern (matches v1 policy in prisma/rls.sql),
-- and enrolls chat_messages in the supabase_realtime publication so the
-- browser can subscribe to postgres_changes on new rows.

-- CreateEnum
CREATE TYPE "ChatChannelKind" AS ENUM ('DIRECT', 'GROUP');

-- CreateTable: chat_channels
CREATE TABLE "chat_channels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT,
    "kind" "ChatChannelKind" NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),

    CONSTRAINT "chat_channels_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chat_channels_kind_idx" ON "chat_channels"("kind");
CREATE INDEX "chat_channels_updated_at_idx" ON "chat_channels"("updated_at" DESC);

ALTER TABLE "chat_channels"
  ADD CONSTRAINT "chat_channels_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- updated_at trigger parity with the tables listed in prisma/triggers.sql:
-- raw inserts/updates from the Supabase JS client would otherwise leave
-- updated_at NULL on subsequent writes.
DROP TRIGGER IF EXISTS tg_chat_channels_updated_at ON "chat_channels";
CREATE TRIGGER tg_chat_channels_updated_at
  BEFORE UPDATE ON "chat_channels"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- CreateTable: chat_channel_members
CREATE TABLE "chat_channel_members" (
    "channel_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "last_read_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_channel_members_pkey" PRIMARY KEY ("channel_id", "user_id")
);

CREATE INDEX "chat_channel_members_user_id_idx" ON "chat_channel_members"("user_id");

ALTER TABLE "chat_channel_members"
  ADD CONSTRAINT "chat_channel_members_channel_id_fkey"
  FOREIGN KEY ("channel_id") REFERENCES "chat_channels"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_channel_members"
  ADD CONSTRAINT "chat_channel_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: chat_messages
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "channel_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chat_messages_channel_id_created_at_idx"
  ON "chat_messages"("channel_id", "created_at" DESC);

ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_channel_id_fkey"
  FOREIGN KEY ("channel_id") REFERENCES "chat_channels"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS parity with the other v1 tables (see prisma/rls.sql): any
-- authenticated team member can read/write everything; the agent uses
-- service_role and bypasses RLS. Per-channel membership is enforced in
-- server actions (lib/mutations/chat.ts), not at the row level.
ALTER TABLE "chat_channels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_channel_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_read_all" ON "chat_channels" FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "team_write_all" ON "chat_channels" FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "team_read_all" ON "chat_channel_members" FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "team_write_all" ON "chat_channel_members" FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "team_read_all" ON "chat_messages" FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "team_write_all" ON "chat_messages" FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Supabase Realtime: browser subscribes to postgres_changes on
-- chat_messages via the supabase_realtime publication. Idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END $$;

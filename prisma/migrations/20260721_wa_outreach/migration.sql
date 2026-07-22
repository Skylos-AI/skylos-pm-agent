-- WA outreach automation (spec: wa-outreach-v1.txt).
-- Additive only: two new enums, four new columns on companies, four new tables
-- (message_templates, pending_approvals, wa_sends, wa_inbound) plus app_settings
-- for the outreach_enabled kill switch. wa_sends carries a UNIQUE
-- (company_id, template_id) as double-send insurance; wa_inbound's PK on
-- wa_message_id makes inbound recording idempotent.

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SENT');

-- AlterTable: companies
ALTER TABLE "companies"
  ADD COLUMN "next_action" TEXT,
  ADD COLUMN "next_action_at" TIMESTAMP(3),
  ADD COLUMN "sequence_position" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "wa_jid" TEXT;

CREATE UNIQUE INDEX "companies_wa_jid_key" ON "companies"("wa_jid");
CREATE INDEX "companies_next_action_at_idx" ON "companies"("next_action_at");

-- CreateTable: message_templates
CREATE TABLE "message_templates" (
    "id" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "stage_trigger" "CompanyStatus" NOT NULL,
    "vertical" TEXT,
    "body" TEXT NOT NULL,
    "variables_required" TEXT[],
    "send_delay_hours" INTEGER NOT NULL DEFAULT 0,
    "send_window" JSONB,
    "next_template_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "message_templates_stage_trigger_active_idx"
  ON "message_templates"("stage_trigger", "active");

ALTER TABLE "message_templates"
  ADD CONSTRAINT "message_templates_next_template_id_fkey"
  FOREIGN KEY ("next_template_id") REFERENCES "message_templates"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

DROP TRIGGER IF EXISTS tg_message_templates_updated_at ON "message_templates";
CREATE TRIGGER tg_message_templates_updated_at
  BEFORE UPDATE ON "message_templates"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- CreateTable: pending_approvals
CREATE TABLE "pending_approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "template_id" TEXT NOT NULL,
    "rendered_body" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_approvals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pending_approvals_status_idx" ON "pending_approvals"("status");

ALTER TABLE "pending_approvals"
  ADD CONSTRAINT "pending_approvals_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pending_approvals"
  ADD CONSTRAINT "pending_approvals_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "message_templates"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pending_approvals"
  ADD CONSTRAINT "pending_approvals_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: wa_sends
CREATE TABLE "wa_sends" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "template_id" TEXT NOT NULL,
    "wa_message_id" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_sends_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wa_sends_company_id_template_id_key"
  ON "wa_sends"("company_id", "template_id");

ALTER TABLE "wa_sends"
  ADD CONSTRAINT "wa_sends_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wa_sends"
  ADD CONSTRAINT "wa_sends_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "message_templates"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: wa_inbound
CREATE TABLE "wa_inbound" (
    "wa_message_id" TEXT NOT NULL,
    "jid" TEXT NOT NULL,
    "company_id" UUID,
    "text" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_inbound_pkey" PRIMARY KEY ("wa_message_id")
);

CREATE INDEX "wa_inbound_jid_idx" ON "wa_inbound"("jid");

-- CreateTable: app_settings
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

DROP TRIGGER IF EXISTS tg_app_settings_updated_at ON "app_settings";
CREATE TRIGGER tg_app_settings_updated_at
  BEFORE UPDATE ON "app_settings"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Kill switch starts OFF; flip via set-outreach-enabled tool or the web UI.
INSERT INTO "app_settings" ("key", "value")
  VALUES ('outreach_enabled', 'false'::jsonb)
  ON CONFLICT ("key") DO NOTHING;

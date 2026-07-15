-- Track D — Outreach follow-up + Asset registry.
-- New enums (ActivityOutcome, PreferredChannel, AssetKind), two new columns on
-- companies (next_touch_at, preferred_channel), two on activities (outcome,
-- asset_id), and a new assets table. Foreign key from activities.asset_id to
-- assets.id uses ON DELETE SET NULL so deactivating an asset does not destroy
-- touch history.
--
-- Trigger setup for assets.updated_at mirrors prisma/triggers.sql. Existing
-- tables' updated_at defaults intentionally left alone — Prisma diff wants to
-- drop them, but the trigger script depends on them.

-- CreateEnum
CREATE TYPE "ActivityOutcome" AS ENUM ('NO_ANSWER', 'REACHED', 'INTERESTED', 'NOT_INTERESTED', 'CALLBACK_REQUESTED', 'MEETING_SCHEDULED', 'VOICEMAIL_LEFT', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "PreferredChannel" AS ENUM ('WHATSAPP', 'PHONE', 'EMAIL', 'IN_PERSON', 'MIXED');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('PROPOSAL', 'DECK', 'ONE_PAGER', 'EMAIL_TEMPLATE', 'BROCHURE', 'CASE_STUDY', 'CONTRACT', 'OTHER');

-- AlterTable: activities
ALTER TABLE "activities"
  ADD COLUMN "asset_id" UUID,
  ADD COLUMN "outcome" "ActivityOutcome";

-- AlterTable: companies
ALTER TABLE "companies"
  ADD COLUMN "next_touch_at" TIMESTAMP(3),
  ADD COLUMN "preferred_channel" "PreferredChannel";

-- CreateTable: assets
CREATE TABLE "assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "external_url" TEXT,
    "version" TEXT,
    "language" TEXT NOT NULL DEFAULT 'es',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- Trigger for assets.updated_at (same pattern as prisma/triggers.sql)
DROP TRIGGER IF EXISTS tg_assets_updated_at ON "assets";
CREATE TRIGGER tg_assets_updated_at
  BEFORE UPDATE ON "assets"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes
CREATE INDEX "assets_kind_idx" ON "assets"("kind");
CREATE INDEX "assets_active_idx" ON "assets"("active");
CREATE INDEX "activities_asset_id_idx" ON "activities"("asset_id");
CREATE INDEX "companies_next_touch_at_idx" ON "companies"("next_touch_at");

-- Foreign key
ALTER TABLE "activities"
  ADD CONSTRAINT "activities_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "assets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

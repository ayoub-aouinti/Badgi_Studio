-- CreateEnum
CREATE TYPE "KioskStatus" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "ParticipantSource" AS ENUM ('BADGE', 'MANUAL');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('AI_PROCESSING', 'WALL', 'SPONSOR');

-- CreateEnum
CREATE TYPE "CaptureSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "PortraitStatus" AS ENUM ('QUEUED', 'MODERATING', 'GENERATING', 'READY', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'PRINT');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendees" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "whatsapp_e164" TEXT,
    "specialty" TEXT,
    "badge_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_configs" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "frame_template" TEXT NOT NULL DEFAULT 'default',
    "sponsor_name" TEXT,
    "sponsor_logo_key" TEXT,
    "retention_days" INTEGER NOT NULL DEFAULT 30,
    "wall_token" TEXT NOT NULL,

    CONSTRAINT "studio_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_styles" (
    "id" TEXT NOT NULL,
    "config_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "preview_key" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "studio_styles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kiosks" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pairing_code" TEXT NOT NULL,
    "device_token_hash" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "status" "KioskStatus" NOT NULL DEFAULT 'OFFLINE',

    CONSTRAINT "kiosks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_participants" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "attendee_id" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "whatsapp_e164" TEXT,
    "specialty" TEXT,
    "source" "ParticipantSource" NOT NULL,

    CONSTRAINT "studio_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "type" "ConsentType" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL,
    "text_version" TEXT NOT NULL,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capture_sessions" (
    "id" TEXT NOT NULL,
    "kiosk_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "status" "CaptureSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',

    CONSTRAINT "capture_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portraits" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "style_id" TEXT NOT NULL,
    "selfie_key" TEXT NOT NULL,
    "result_key" TEXT,
    "framed_key" TEXT,
    "status" "PortraitStatus" NOT NULL DEFAULT 'QUEUED',
    "provider_request_id" TEXT,
    "cost_usd" DECIMAL(10,4),
    "on_wall" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "public_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purge_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portraits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "portrait_id" TEXT NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "provider_message_id" TEXT,
    "cost_usd" DECIMAL(10,4),
    "sent_at" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "attendees_badge_token_key" ON "attendees"("badge_token");

-- CreateIndex
CREATE INDEX "attendees_event_id_idx" ON "attendees"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "studio_configs_event_id_key" ON "studio_configs"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "studio_configs_wall_token_key" ON "studio_configs"("wall_token");

-- CreateIndex
CREATE INDEX "studio_styles_config_id_idx" ON "studio_styles"("config_id");

-- CreateIndex
CREATE UNIQUE INDEX "kiosks_pairing_code_key" ON "kiosks"("pairing_code");

-- CreateIndex
CREATE INDEX "kiosks_event_id_idx" ON "kiosks"("event_id");

-- CreateIndex
CREATE INDEX "studio_participants_event_id_idx" ON "studio_participants"("event_id");

-- CreateIndex
CREATE INDEX "consents_participant_id_idx" ON "consents"("participant_id");

-- CreateIndex
CREATE INDEX "capture_sessions_kiosk_id_idx" ON "capture_sessions"("kiosk_id");

-- CreateIndex
CREATE INDEX "capture_sessions_participant_id_idx" ON "capture_sessions"("participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "portraits_public_code_key" ON "portraits"("public_code");

-- CreateIndex
CREATE INDEX "portraits_status_idx" ON "portraits"("status");

-- CreateIndex
CREATE INDEX "portraits_purge_at_idx" ON "portraits"("purge_at");

-- CreateIndex
CREATE INDEX "portraits_session_id_idx" ON "portraits"("session_id");

-- CreateIndex
CREATE INDEX "deliveries_portrait_id_idx" ON "deliveries"("portrait_id");

-- AddForeignKey
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_configs" ADD CONSTRAINT "studio_configs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_styles" ADD CONSTRAINT "studio_styles_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "studio_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kiosks" ADD CONSTRAINT "kiosks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_participants" ADD CONSTRAINT "studio_participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_participants" ADD CONSTRAINT "studio_participants_attendee_id_fkey" FOREIGN KEY ("attendee_id") REFERENCES "attendees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "studio_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capture_sessions" ADD CONSTRAINT "capture_sessions_kiosk_id_fkey" FOREIGN KEY ("kiosk_id") REFERENCES "kiosks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capture_sessions" ADD CONSTRAINT "capture_sessions_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "studio_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portraits" ADD CONSTRAINT "portraits_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "capture_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portraits" ADD CONSTRAINT "portraits_style_id_fkey" FOREIGN KEY ("style_id") REFERENCES "studio_styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_portrait_id_fkey" FOREIGN KEY ("portrait_id") REFERENCES "portraits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

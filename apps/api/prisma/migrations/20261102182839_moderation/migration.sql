-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "portraits" ADD COLUMN     "moderated_at" TIMESTAMP(3),
ADD COLUMN     "moderation" "ModerationStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN     "moderation_reason" TEXT;

-- AlterTable
ALTER TABLE "studio_configs" ADD COLUMN     "pre_moderation" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "portraits_moderation_idx" ON "portraits"("moderation");

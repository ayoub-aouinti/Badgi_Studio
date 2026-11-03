-- AlterTable
ALTER TABLE "portraits" ADD COLUMN     "video_key" TEXT;

-- AlterTable: gallery_token is filled for existing events before becoming required (new rows
-- get theirs from Prisma's uuid() default).
ALTER TABLE "studio_configs" ADD COLUMN     "gallery_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gallery_token" TEXT,
ADD COLUMN     "print_enabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "studio_configs" SET "gallery_token" = gen_random_uuid()::text WHERE "gallery_token" IS NULL;

ALTER TABLE "studio_configs" ALTER COLUMN "gallery_token" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "studio_configs_gallery_token_key" ON "studio_configs"("gallery_token");

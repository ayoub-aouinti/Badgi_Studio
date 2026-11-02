-- AlterTable
ALTER TABLE "portraits" ADD COLUMN     "purged_at" TIMESTAMP(3),
ALTER COLUMN "selfie_key" DROP NOT NULL;

-- AlterTable
ALTER TABLE "studio_participants" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

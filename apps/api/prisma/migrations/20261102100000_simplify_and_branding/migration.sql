-- Remove sponsor consents before the enum value is dropped.
DELETE FROM "consents" WHERE "type" = 'SPONSOR';

-- AlterEnum
BEGIN;
CREATE TYPE "ConsentType_new" AS ENUM ('AI_PROCESSING', 'WALL');
ALTER TABLE "consents" ALTER COLUMN "type" TYPE "ConsentType_new" USING ("type"::text::"ConsentType_new");
ALTER TYPE "ConsentType" RENAME TO "ConsentType_old";
ALTER TYPE "ConsentType_new" RENAME TO "ConsentType";
DROP TYPE "ConsentType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "attendees" DROP CONSTRAINT "attendees_event_id_fkey";

-- DropForeignKey
ALTER TABLE "studio_participants" DROP CONSTRAINT "studio_participants_attendee_id_fkey";

-- AlterTable
ALTER TABLE "studio_configs" DROP COLUMN "frame_template",
DROP COLUMN "sponsor_logo_key",
DROP COLUMN "sponsor_name",
ADD COLUMN     "accent_color" TEXT NOT NULL DEFAULT '#5FD3C8',
ADD COLUMN     "frame_color" TEXT NOT NULL DEFAULT '#0E1B2C',
ADD COLUMN     "frame_style" TEXT NOT NULL DEFAULT 'banner',
ADD COLUMN     "frame_width" INTEGER NOT NULL DEFAULT 32,
ADD COLUMN     "logo_key" TEXT,
ADD COLUMN     "primary_color" TEXT NOT NULL DEFAULT '#0B6E69',
ADD COLUMN     "show_logo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_name" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tagline" TEXT;

-- AlterTable
ALTER TABLE "studio_participants" DROP COLUMN "attendee_id",
DROP COLUMN "source",
DROP COLUMN "specialty";

-- DropTable
DROP TABLE "attendees";

-- DropEnum
DROP TYPE "ParticipantSource";

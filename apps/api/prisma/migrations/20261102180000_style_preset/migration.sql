-- AlterTable
ALTER TABLE "studio_styles" ADD COLUMN     "preset" TEXT NOT NULL DEFAULT 'pro';

-- Styles used to be recognised by name.
UPDATE "studio_styles" SET "preset" = 'caricature' WHERE "name" ILIKE '%caricature%';
UPDATE "studio_styles" SET "preset" = 'pencil' WHERE "name" ILIKE '%crayon%' OR "name" ILIKE '%pencil%';

-- Simplifie ShiftCategory vers JOUR/NUIT.
BEGIN;
CREATE TYPE "ShiftCategory_new" AS ENUM ('JOUR', 'NUIT');
ALTER TABLE "ShiftType" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "ShiftType" ALTER COLUMN "category" TYPE "ShiftCategory_new" USING (
  CASE
    WHEN "category"::text = 'NUIT' THEN 'NUIT'::"ShiftCategory_new"
    ELSE 'JOUR'::"ShiftCategory_new"
  END
);
ALTER TYPE "ShiftCategory" RENAME TO "ShiftCategory_old";
ALTER TYPE "ShiftCategory_new" RENAME TO "ShiftCategory";
DROP TYPE "ShiftCategory_old";
COMMIT;

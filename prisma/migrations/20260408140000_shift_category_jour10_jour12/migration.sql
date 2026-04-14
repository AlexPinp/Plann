-- Passe ShiftCategory de JOUR/NUIT (ou valeurs legacy) vers JOUR10, JOUR12, NUIT.
BEGIN;
CREATE TYPE "ShiftCategory_new" AS ENUM ('JOUR10', 'JOUR12', 'NUIT');
ALTER TABLE "ShiftType" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "ShiftType" ALTER COLUMN "category" TYPE "ShiftCategory_new" USING (
  CASE
    WHEN "category"::text = 'NUIT' THEN 'NUIT'::"ShiftCategory_new"
    WHEN "category"::text = 'JOUR10' THEN 'JOUR10'::"ShiftCategory_new"
    WHEN "category"::text = 'JOUR12' THEN 'JOUR12'::"ShiftCategory_new"
    WHEN "category"::text = 'JOUR' THEN 'JOUR12'::"ShiftCategory_new"
    WHEN "category"::text IN ('MATIN', 'APREM') THEN 'JOUR10'::"ShiftCategory_new"
    ELSE 'JOUR10'::"ShiftCategory_new"
  END
);
ALTER TYPE "ShiftCategory" RENAME TO "ShiftCategory_old";
ALTER TYPE "ShiftCategory_new" RENAME TO "ShiftCategory";
DROP TYPE "ShiftCategory_old";
COMMIT;

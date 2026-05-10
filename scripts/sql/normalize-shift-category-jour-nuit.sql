-- À exécuter dans Supabase : SQL Editor (une fois), si l’erreur indique :
--   invalid input value for enum "ShiftCategory": "JOUR"
-- Cela signifie que le type Postgres ShiftCategory n’a pas encore les libellés JOUR / NUIT
-- (souvent encore JOUR10 / JOUR12 / MATIN…).
--
-- Équivalent à la migration prisma/migrations/20260509120000_renormalize_shift_category_enum/
-- Préférez si possible : npx prisma migrate deploy (même base que l’app).

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

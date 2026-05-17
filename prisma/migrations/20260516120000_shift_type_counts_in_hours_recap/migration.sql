-- AlterTable
ALTER TABLE "ShiftType" ADD COLUMN IF NOT EXISTS "countsInHoursRecap" BOOLEAN NOT NULL DEFAULT true;

-- Congés / absences : aligné sur l'ancien filtre codé en dur (CA, CF, CH, RTT)
UPDATE "ShiftType"
SET "countsInHoursRecap" = false
WHERE "code" IN ('CA', 'CF', 'CH', 'RTT');

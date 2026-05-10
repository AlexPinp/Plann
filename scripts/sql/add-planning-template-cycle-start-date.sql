-- Colonne manquante si cette erreur apparaît :
--   The column `cycleStartDate` of relation `PlanningTemplate` does not exist
--
-- Préférez : npx prisma migrate deploy (applique prisma/migrations/20260509140000_planning_template_cycle_start_date/)
-- Sinon : collez ce script dans Supabase > SQL Editor.

ALTER TABLE "PlanningTemplate" ADD COLUMN IF NOT EXISTS "cycleStartDate" DATE;

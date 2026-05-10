-- Codes horaires (ShiftType) rattachés à chaque équipe : contrainte d'unicité (teamId, code).
-- Idempotent : peut être rejoué après un échec partiel (colonne teamId déjà créée, etc.).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE "ShiftType" ADD COLUMN IF NOT EXISTS "teamId" TEXT;

UPDATE "ShiftType"
SET "teamId" = (SELECT id FROM "Team" ORDER BY "displayOrder" ASC LIMIT 1)
WHERE "teamId" IS NULL;

-- Obligatoire avant les lignes dupliquées : l’ancien unique global sur `code` empêchait plusieurs équipes d’avoir le même libellé de code.
DROP INDEX IF EXISTS "ShiftType_code_key";

INSERT INTO "ShiftType" ("id", "teamId", "code", "label", "color", "startsAt", "endsAt", "category", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  ot.id,
  cs."code",
  cs."label",
  cs."color",
  cs."startsAt",
  cs."endsAt",
  cs."category",
  NOW(),
  NOW()
FROM "Team" ot
CROSS JOIN "ShiftType" cs
WHERE ot.id <> cs."teamId"
  AND cs."teamId" = (SELECT id FROM "Team" ORDER BY "displayOrder" ASC LIMIT 1)
  AND NOT EXISTS (
    SELECT 1 FROM "ShiftType" z WHERE z."teamId" = ot.id AND z."code" = cs."code"
  );

UPDATE "Assignment" AS a
SET "shiftTypeId" = st_new.id
FROM "PlanningWeek" pw,
     "ShiftType" st_old,
     "ShiftType" st_new
WHERE a."planningWeekId" = pw.id
  AND st_old.id = a."shiftTypeId"
  AND st_new."teamId" = pw."teamId"
  AND st_new."code" = st_old."code";

UPDATE "PlanningTemplateEntry" AS e
SET "shiftTypeId" = st_new.id
FROM "PlanningTemplate" tpl,
     "ShiftType" st_old,
     "ShiftType" st_new
WHERE e."templateId" = tpl.id
  AND e."shiftTypeId" IS NOT NULL
  AND st_old.id = e."shiftTypeId"
  AND st_new."teamId" = tpl."teamId"
  AND st_new."code" = st_old."code";

INSERT INTO "ShiftSkill" ("shiftTypeId", "skillId")
SELECT st_new.id, ss."skillId"
FROM "ShiftSkill" ss
JOIN "ShiftType" st_canon ON st_canon.id = ss."shiftTypeId"
JOIN "ShiftType" st_new ON st_new."code" = st_canon."code" AND st_new."teamId" <> st_canon."teamId"
WHERE st_canon."teamId" = (SELECT id FROM "Team" ORDER BY "displayOrder" ASC LIMIT 1)
  AND NOT EXISTS (
    SELECT 1 FROM "ShiftSkill" z WHERE z."shiftTypeId" = st_new.id AND z."skillId" = ss."skillId"
  );

ALTER TABLE "ShiftType" ALTER COLUMN "teamId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShiftType_teamId_fkey'
  ) THEN
    ALTER TABLE "ShiftType"
      ADD CONSTRAINT "ShiftType_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ShiftType_teamId_code_key" ON "ShiftType"("teamId", "code");

CREATE INDEX IF NOT EXISTS "ShiftType_teamId_idx" ON "ShiftType"("teamId");

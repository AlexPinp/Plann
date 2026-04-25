-- Découpage du service en 4 équipes (IDE jour, IDE nuit, AS jour, AS nuit).
--
-- Stratégie : on introduit `Team` et `UserTeam` sans toucher aux colonnes
-- existantes de `User` (planningGroupLabel, planningTemplateNumber, etc.)
-- pour que le code actuel continue de fonctionner pendant la transition.
-- Tout l'existant est backfillé sur l'équipe `ide-jour`.

-- 1) Enums
CREATE TYPE "TeamJob"    AS ENUM ('IDE', 'AS');
CREATE TYPE "TeamRhythm" AS ENUM ('JOUR', 'NUIT');

-- 2) Table Team
CREATE TABLE "Team" (
  "id"           TEXT         NOT NULL,
  "slug"         TEXT         NOT NULL,
  "label"        TEXT         NOT NULL,
  "job"          "TeamJob"    NOT NULL,
  "rhythm"       "TeamRhythm" NOT NULL,
  "color"        TEXT         NOT NULL DEFAULT '#e2e8f0',
  "displayOrder" INTEGER      NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");
ALTER TABLE "Team" ENABLE ROW LEVEL SECURITY;

-- 3) Seed initial des 4 équipes (ids stables, utilisés par les backfills ci-dessous)
INSERT INTO "Team" ("id", "slug", "label", "job", "rhythm", "color", "displayOrder", "updatedAt") VALUES
  ('team_ide_jour', 'ide-jour', 'Infirmiers de jour',      'IDE', 'JOUR', '#bbf7d0', 0, CURRENT_TIMESTAMP),
  ('team_ide_nuit', 'ide-nuit', 'Infirmiers de nuit',      'IDE', 'NUIT', '#c7d2fe', 1, CURRENT_TIMESTAMP),
  ('team_as_jour',  'as-jour',  'Aides-soignants de jour', 'AS',  'JOUR', '#fde68a', 2, CURRENT_TIMESTAMP),
  ('team_as_nuit',  'as-nuit',  'Aides-soignants de nuit', 'AS',  'NUIT', '#fbcfe8', 3, CURRENT_TIMESTAMP);

-- 4) Table UserTeam (appartenance + champs de planning par équipe)
CREATE TABLE "UserTeam" (
  "userId"                  TEXT         NOT NULL,
  "teamId"                  TEXT         NOT NULL,
  "roleInTeam"              "UserRole"   NOT NULL DEFAULT 'AGENT',
  "isPrimary"               BOOLEAN      NOT NULL DEFAULT FALSE,
  "planningGroupLabel"      TEXT,
  "planningGroupColor"      TEXT,
  "displayOrder"            INTEGER      NOT NULL DEFAULT 0,
  "planningTemplateNumber"  INTEGER,
  "planningTemplateNumberA" INTEGER,
  "planningTemplateNumberB" INTEGER,
  "planningGroupLabelA"     TEXT,
  "planningGroupLabelB"     TEXT,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserTeam_pkey" PRIMARY KEY ("userId", "teamId")
);
CREATE INDEX "UserTeam_teamId_idx" ON "UserTeam"("teamId");
-- Au plus une équipe primaire par utilisateur (index partiel).
CREATE UNIQUE INDEX "UserTeam_userId_isPrimary_true_key" ON "UserTeam"("userId") WHERE "isPrimary" IS TRUE;
ALTER TABLE "UserTeam" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserTeam" ADD CONSTRAINT "UserTeam_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserTeam" ADD CONSTRAINT "UserTeam_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5) Backfill : tous les utilisateurs existants rejoignent IDE jour (primaire),
--    en conservant leur trame, leur bloc et leur rôle actuel.
INSERT INTO "UserTeam" (
  "userId", "teamId", "roleInTeam", "isPrimary",
  "planningGroupLabel", "planningGroupColor", "displayOrder",
  "planningTemplateNumber", "planningTemplateNumberA", "planningTemplateNumberB",
  "planningGroupLabelA", "planningGroupLabelB", "updatedAt"
)
SELECT
  u."id", 'team_ide_jour', u."role", TRUE,
  u."planningGroupLabel", u."planningGroupColor", u."displayOrder",
  u."planningTemplateNumber", u."planningTemplateNumberA", u."planningTemplateNumberB",
  u."planningGroupLabelA", u."planningGroupLabelB", CURRENT_TIMESTAMP
FROM "User" u;

-- 6) PlanningTemplate : ajout teamId / label / cycleWeeks + unique par équipe
ALTER TABLE "PlanningTemplate"
  ADD COLUMN "teamId"     TEXT,
  ADD COLUMN "label"      TEXT,
  ADD COLUMN "cycleWeeks" INTEGER NOT NULL DEFAULT 6;

UPDATE "PlanningTemplate" SET "teamId" = 'team_ide_jour' WHERE "teamId" IS NULL;
UPDATE "PlanningTemplate" SET "label"  = 'Trame ' || "number"::text WHERE "label" IS NULL;

ALTER TABLE "PlanningTemplate"
  ALTER COLUMN "teamId" SET NOT NULL,
  ALTER COLUMN "label"  SET NOT NULL;

DROP INDEX IF EXISTS "PlanningTemplate_number_key";
CREATE UNIQUE INDEX "PlanningTemplate_teamId_number_key" ON "PlanningTemplate"("teamId", "number");
CREATE INDEX        "PlanningTemplate_teamId_idx"        ON "PlanningTemplate"("teamId");

ALTER TABLE "PlanningTemplate" ADD CONSTRAINT "PlanningTemplate_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7) PlanningWeek : ajout teamId + unique (teamId, weekStart)
ALTER TABLE "PlanningWeek" ADD COLUMN "teamId" TEXT;
UPDATE "PlanningWeek" SET "teamId" = 'team_ide_jour' WHERE "teamId" IS NULL;
ALTER TABLE "PlanningWeek" ALTER COLUMN "teamId" SET NOT NULL;

DROP INDEX IF EXISTS "PlanningWeek_weekStart_key";
CREATE UNIQUE INDEX "PlanningWeek_teamId_weekStart_key" ON "PlanningWeek"("teamId", "weekStart");
CREATE INDEX        "PlanningWeek_teamId_idx"           ON "PlanningWeek"("teamId");

ALTER TABLE "PlanningWeek" ADD CONSTRAINT "PlanningWeek_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

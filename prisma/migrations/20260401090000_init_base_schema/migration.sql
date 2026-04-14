-- Baseline initial schema required before ALTER migrations.
CREATE TYPE "UserRole" AS ENUM ('READ_ONLY', 'CADRE', 'ADMIN');
CREATE TYPE "ShiftCategory" AS ENUM ('MATIN', 'APREM', 'NUIT');
CREATE TYPE "AvailabilityType" AS ENUM ('CONGE', 'ARRET', 'FORMATION', 'AUTRE');
CREATE TYPE "PlanningStatus" AS ENUM ('DRAFT', 'VALIDATED', 'PUBLISHED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'READ_ONLY',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "workPercentage" INTEGER NOT NULL DEFAULT 100,
  "planningGroupLabel" TEXT,
  "planningGroupColor" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Skill" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserSkill" (
  "userId" TEXT NOT NULL,
  "skillId" TEXT NOT NULL,
  CONSTRAINT "UserSkill_pkey" PRIMARY KEY ("userId", "skillId")
);

CREATE TABLE "ShiftType" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "startsAt" TEXT NOT NULL,
  "endsAt" TEXT NOT NULL,
  "category" "ShiftCategory" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShiftType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShiftSkill" (
  "shiftTypeId" TEXT NOT NULL,
  "skillId" TEXT NOT NULL,
  CONSTRAINT "ShiftSkill_pkey" PRIMARY KEY ("shiftTypeId", "skillId")
);

CREATE TABLE "Availability" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "type" "AvailabilityType" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanningWeek" (
  "id" TEXT NOT NULL,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "status" "PlanningStatus" NOT NULL DEFAULT 'DRAFT',
  "validatedAt" TIMESTAMP(3),
  "validatedBy" TEXT,
  "validatedByName" TEXT,
  "publishedAt" TIMESTAMP(3),
  "publishedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanningWeek_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Assignment" (
  "id" TEXT NOT NULL,
  "planningWeekId" TEXT NOT NULL,
  "shiftTypeId" TEXT NOT NULL,
  "userId" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "details" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");
CREATE UNIQUE INDEX "ShiftType_code_key" ON "ShiftType"("code");
CREATE UNIQUE INDEX "PlanningWeek_weekStart_key" ON "PlanningWeek"("weekStart");
CREATE INDEX "Assignment_userId_date_idx" ON "Assignment"("userId", "date");

ALTER TABLE "UserSkill"
ADD CONSTRAINT "UserSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSkill"
ADD CONSTRAINT "UserSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShiftSkill"
ADD CONSTRAINT "ShiftSkill_shiftTypeId_fkey" FOREIGN KEY ("shiftTypeId") REFERENCES "ShiftType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftSkill"
ADD CONSTRAINT "ShiftSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Availability"
ADD CONSTRAINT "Availability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Assignment"
ADD CONSTRAINT "Assignment_planningWeekId_fkey" FOREIGN KEY ("planningWeekId") REFERENCES "PlanningWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Assignment"
ADD CONSTRAINT "Assignment_shiftTypeId_fkey" FOREIGN KEY ("shiftTypeId") REFERENCES "ShiftType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Assignment"
ADD CONSTRAINT "Assignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditLog"
ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

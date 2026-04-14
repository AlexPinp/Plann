ALTER TABLE "User"
ADD COLUMN "planningTemplateNumber" INTEGER;

CREATE TABLE "PlanningTemplate" (
  "id" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanningTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanningTemplateEntry" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "dayOffset" INTEGER NOT NULL,
  "shiftTypeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanningTemplateEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanningTemplate_number_key" ON "PlanningTemplate"("number");
CREATE UNIQUE INDEX "PlanningTemplateEntry_templateId_dayOffset_key" ON "PlanningTemplateEntry"("templateId", "dayOffset");
CREATE INDEX "PlanningTemplateEntry_shiftTypeId_idx" ON "PlanningTemplateEntry"("shiftTypeId");

ALTER TABLE "PlanningTemplateEntry"
ADD CONSTRAINT "PlanningTemplateEntry_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PlanningTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlanningTemplateEntry"
ADD CONSTRAINT "PlanningTemplateEntry_shiftTypeId_fkey" FOREIGN KEY ("shiftTypeId") REFERENCES "ShiftType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

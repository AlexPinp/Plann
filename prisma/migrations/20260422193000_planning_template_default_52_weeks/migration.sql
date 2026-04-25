-- Default cycle length for new planning templates: 52 weeks (existing rows unchanged).
ALTER TABLE "PlanningTemplate" ALTER COLUMN "cycleWeeks" SET DEFAULT 52;

-- Reconcile PlanningTemplate* updatedAt defaults with current database.
ALTER TABLE "PlanningTemplate" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PlanningTemplateEntry" ALTER COLUMN "updatedAt" DROP DEFAULT;

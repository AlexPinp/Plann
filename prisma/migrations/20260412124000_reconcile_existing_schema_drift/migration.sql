-- Reconcile schema history with existing database without reset.
ALTER TYPE "ShiftCategory" ADD VALUE IF NOT EXISTS 'JOUR7_50';

ALTER TABLE "Assignment" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PlanningWeek" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "ShiftType" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

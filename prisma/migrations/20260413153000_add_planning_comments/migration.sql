CREATE TYPE "PlanningCommentType" AS ENUM ('CA', 'FORMATION', 'ABSENCE', 'INFO', 'BLOCAGE');

CREATE TYPE "PlanningCommentStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REFUSED');

CREATE TYPE "PlanningCommentVisibility" AS ENUM ('TEAM', 'MANAGER', 'PRIVATE');

CREATE TABLE "PlanningComment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "type" "PlanningCommentType" NOT NULL,
  "status" "PlanningCommentStatus" NOT NULL DEFAULT 'NONE',
  "visibility" "PlanningCommentVisibility" NOT NULL DEFAULT 'TEAM',
  "text" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlanningComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlanningComment_userId_date_idx" ON "PlanningComment"("userId", "date");
CREATE INDEX "PlanningComment_date_idx" ON "PlanningComment"("date");
CREATE INDEX "PlanningComment_createdById_idx" ON "PlanningComment"("createdById");

ALTER TABLE "PlanningComment"
ADD CONSTRAINT "PlanningComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlanningComment"
ADD CONSTRAINT "PlanningComment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

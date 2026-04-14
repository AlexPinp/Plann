CREATE TYPE "CommentaryStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

CREATE TABLE "CommentaryEntry" (
  "id" TEXT NOT NULL,
  "monthLabel" TEXT,
  "datesLabel" TEXT,
  "subject" TEXT NOT NULL,
  "personnel" TEXT,
  "trainer" TEXT,
  "comment" TEXT,
  "status" "CommentaryStatus" NOT NULL DEFAULT 'TODO',
  "createdById" TEXT,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommentaryEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FollowUpEntry" (
  "id" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "personnel" TEXT,
  "lastDate" TIMESTAMP(3),
  "lastBy" TEXT,
  "nextDate" TIMESTAMP(3),
  "nextBy" TEXT,
  "note" TEXT,
  "createdById" TEXT,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FollowUpEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommentaryEntry_status_idx" ON "CommentaryEntry"("status");
CREATE INDEX "CommentaryEntry_createdAt_idx" ON "CommentaryEntry"("createdAt");
CREATE INDEX "CommentaryEntry_createdById_idx" ON "CommentaryEntry"("createdById");

CREATE INDEX "FollowUpEntry_createdAt_idx" ON "FollowUpEntry"("createdAt");
CREATE INDEX "FollowUpEntry_createdById_idx" ON "FollowUpEntry"("createdById");
CREATE INDEX "FollowUpEntry_nextDate_idx" ON "FollowUpEntry"("nextDate");

ALTER TABLE "CommentaryEntry"
ADD CONSTRAINT "CommentaryEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FollowUpEntry"
ADD CONSTRAINT "FollowUpEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

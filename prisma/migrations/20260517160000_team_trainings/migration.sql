-- CreateTable
CREATE TABLE "TeamTrainingType" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "recurrenceMonths" INTEGER,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamTrainingType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTrainingCompletion" (
    "userId" TEXT NOT NULL,
    "trainingTypeId" TEXT NOT NULL,
    "lastCompletedAt" DATE,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTrainingCompletion_pkey" PRIMARY KEY ("userId","trainingTypeId")
);

-- CreateIndex
CREATE INDEX "TeamTrainingType_teamId_idx" ON "TeamTrainingType"("teamId");

-- CreateIndex
CREATE INDEX "UserTrainingCompletion_trainingTypeId_idx" ON "UserTrainingCompletion"("trainingTypeId");

-- AddForeignKey
ALTER TABLE "TeamTrainingType" ADD CONSTRAINT "TeamTrainingType_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTrainingCompletion" ADD CONSTRAINT "UserTrainingCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTrainingCompletion" ADD CONSTRAINT "UserTrainingCompletion_trainingTypeId_fkey" FOREIGN KEY ("trainingTypeId") REFERENCES "TeamTrainingType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "isAlternant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "alternanceCycleWeeks" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN "alternanceAnchorDate" TIMESTAMP(3),
ADD COLUMN "alternancePhase" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "planningTemplateNumberA" INTEGER,
ADD COLUMN "planningTemplateNumberB" INTEGER,
ADD COLUMN "planningGroupLabelA" TEXT,
ADD COLUMN "planningGroupLabelB" TEXT,
ADD COLUMN "alternancePartnerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_alternancePartnerId_key" ON "User"("alternancePartnerId");

-- AddForeignKey
ALTER TABLE "User"
ADD CONSTRAINT "User_alternancePartnerId_fkey"
FOREIGN KEY ("alternancePartnerId")
REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

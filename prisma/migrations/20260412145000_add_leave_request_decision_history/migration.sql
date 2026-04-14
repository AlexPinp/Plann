ALTER TABLE "LeaveRequest"
ADD COLUMN "decidedById" TEXT,
ADD COLUMN "decidedByName" TEXT,
ADD COLUMN "decidedAt" TIMESTAMP(3),
ADD COLUMN "decisionNote" TEXT;

CREATE INDEX "LeaveRequest_decidedById_idx" ON "LeaveRequest"("decidedById");

ALTER TABLE "LeaveRequest"
ADD CONSTRAINT "LeaveRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

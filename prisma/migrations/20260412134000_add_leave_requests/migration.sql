CREATE TYPE "LeaveRequestType" AS ENUM ('CA', 'CF', 'CH', 'RTT', 'REC', 'AUTRE');
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'CANCELLED');

CREATE TABLE "LeaveRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "LeaveRequestType" NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeaveRequest_userId_startsAt_idx" ON "LeaveRequest"("userId", "startsAt");
CREATE INDEX "LeaveRequest_createdAt_idx" ON "LeaveRequest"("createdAt");

ALTER TABLE "LeaveRequest"
ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

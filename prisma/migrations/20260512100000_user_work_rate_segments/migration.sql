CREATE TABLE "UserWorkRateSegment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthStartsOn" DATE NOT NULL,
    "workPercentage" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserWorkRateSegment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserWorkRateSegment_userId_monthStartsOn_key" ON "UserWorkRateSegment"("userId", "monthStartsOn");

CREATE INDEX "UserWorkRateSegment_userId_idx" ON "UserWorkRateSegment"("userId");

ALTER TABLE "UserWorkRateSegment" ADD CONSTRAINT "UserWorkRateSegment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."UserWorkRateSegment" ENABLE ROW LEVEL SECURITY;

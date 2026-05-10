-- CreateTable
CREATE TABLE "public"."GoogleCalendarAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleSubject" TEXT,
    "googleEmail" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessTokenExpiry" TIMESTAMP(3),
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCalendarAccount_userId_key" ON "public"."GoogleCalendarAccount"("userId");

-- AddForeignKey
ALTER TABLE "public"."GoogleCalendarAccount" ADD CONSTRAINT "GoogleCalendarAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

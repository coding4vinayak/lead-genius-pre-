-- CreateEnum
CREATE TYPE "WarmupStatus" AS ENUM ('warming', 'paused', 'completed');

-- CreateTable
CREATE TABLE "WarmupSchedule" (
    "id" TEXT NOT NULL,
    "accountEmail" TEXT NOT NULL,
    "status" "WarmupStatus" NOT NULL DEFAULT 'warming',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentDay" INTEGER NOT NULL DEFAULT 1,
    "currentDailyLimit" INTEGER NOT NULL DEFAULT 5,
    "maxDailyLimit" INTEGER NOT NULL DEFAULT 50,
    "rampPercentage" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "sentToday" INTEGER NOT NULL DEFAULT 0,
    "bouncedToday" INTEGER NOT NULL DEFAULT 0,
    "bounceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "pausedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarmupSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarmupLog" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "bounced" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarmupLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WarmupSchedule_accountEmail_idx" ON "WarmupSchedule"("accountEmail");

-- CreateIndex
CREATE INDEX "WarmupSchedule_status_idx" ON "WarmupSchedule"("status");

-- CreateIndex
CREATE INDEX "WarmupLog_scheduleId_idx" ON "WarmupLog"("scheduleId");

-- CreateIndex
CREATE INDEX "WarmupLog_date_idx" ON "WarmupLog"("date");

-- AddForeignKey
ALTER TABLE "WarmupLog" ADD CONSTRAINT "WarmupLog_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "WarmupSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

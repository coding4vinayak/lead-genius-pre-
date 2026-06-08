-- CreateEnum
CREATE TYPE "WarmupStep" AS ENUM ('linkedin_connect', 'linkedin_like', 'linkedin_comment', 'linkedin_share', 'website_visit', 'content_share', 'email_intro', 'email_value', 'email_case_study', 'email_meeting');

-- AlterTable: add warming and sourcing fields to Lead
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "linkedinUrl" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "websiteUrl" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "warmupActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "warmupStep" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "warmupStartedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Lead_warmupActive_idx" ON "Lead"("warmupActive");

-- CreateTable: WarmupSettings
CREATE TABLE "WarmupSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "maxActiveWarmups" INTEGER NOT NULL DEFAULT 20,
    "stepsPerDay" INTEGER NOT NULL DEFAULT 2,
    "minDelayHours" INTEGER NOT NULL DEFAULT 12,
    "maxDelayHours" INTEGER NOT NULL DEFAULT 48,
    "workingHoursStart" TEXT NOT NULL DEFAULT '09:00',
    "workingHoursEnd" TEXT NOT NULL DEFAULT '18:00',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "steps" "WarmupStep"[] DEFAULT ARRAY['linkedin_connect', 'linkedin_like', 'linkedin_comment', 'email_intro', 'website_visit', 'content_share', 'email_value', 'email_case_study', 'email_meeting']::"WarmupStep"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WarmupSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WarmupTask
CREATE TABLE "WarmupTask" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "step" "WarmupStep" NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "channel" "Channel" NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'queued',
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WarmupTask_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WarmupTask" ADD CONSTRAINT "WarmupTask_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "WarmupTask_leadId_idx" ON "WarmupTask"("leadId");
CREATE INDEX "WarmupTask_status_idx" ON "WarmupTask"("status");
CREATE INDEX "WarmupTask_scheduledAt_idx" ON "WarmupTask"("scheduledAt");

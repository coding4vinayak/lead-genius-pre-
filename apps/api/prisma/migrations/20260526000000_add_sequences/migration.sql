-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('new', 'contacted', 'engaged', 'warm', 'hot', 'converted', 'lost');

-- CreateEnum
CREATE TYPE "SequenceStatus" AS ENUM ('draft', 'active', 'paused', 'completed');

-- CreateEnum
CREATE TYPE "SequenceStepType" AS ENUM ('send_email', 'send_whatsapp', 'delay', 'condition', 'update_lead_stage', 'update_lead_score');

-- CreateEnum
CREATE TYPE "SequenceEnrollmentStatus" AS ENUM ('active', 'paused', 'completed', 'exited');

-- CreateEnum
CREATE TYPE "SequenceStepExecutionStatus" AS ENUM ('pending', 'completed', 'failed', 'skipped');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "stage" "LeadStage" NOT NULL DEFAULT 'new';

-- CreateTable
CREATE TABLE "Sequence" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "SequenceStatus" NOT NULL DEFAULT 'draft',
    "leadGroupIds" TEXT[],
    "triggerType" TEXT NOT NULL DEFAULT 'manual',
    "triggerConfig" JSONB NOT NULL DEFAULT '{}',
    "pauseOnReply" BOOLEAN NOT NULL DEFAULT true,
    "sendingWindowStart" TEXT,
    "sendingWindowEnd" TEXT,
    "dailyLimit" INTEGER,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceStep" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "SequenceStepType" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "nextStepId" TEXT,
    "conditionTrueStepId" TEXT,
    "conditionFalseStepId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceEnrollment" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" "SequenceEnrollmentStatus" NOT NULL DEFAULT 'active',
    "currentStepId" TEXT,
    "nextRunAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "exitReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceStepExecution" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "status" "SequenceStepExecutionStatus" NOT NULL DEFAULT 'pending',
    "executedAt" TIMESTAMP(3),
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SequenceStepExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sequence_status_idx" ON "Sequence"("status");
CREATE INDEX "Sequence_createdAt_idx" ON "Sequence"("createdAt");

-- CreateIndex
CREATE INDEX "SequenceStep_sequenceId_idx" ON "SequenceStep"("sequenceId");
CREATE INDEX "SequenceStep_position_idx" ON "SequenceStep"("position");

-- CreateIndex
CREATE INDEX "SequenceEnrollment_sequenceId_idx" ON "SequenceEnrollment"("sequenceId");
CREATE INDEX "SequenceEnrollment_leadId_idx" ON "SequenceEnrollment"("leadId");
CREATE INDEX "SequenceEnrollment_status_idx" ON "SequenceEnrollment"("status");
CREATE INDEX "SequenceEnrollment_nextRunAt_idx" ON "SequenceEnrollment"("nextRunAt");

-- CreateIndex
CREATE INDEX "SequenceStepExecution_enrollmentId_idx" ON "SequenceStepExecution"("enrollmentId");
CREATE INDEX "SequenceStepExecution_stepId_idx" ON "SequenceStepExecution"("stepId");

-- CreateIndex
CREATE INDEX "Lead_stage_idx" ON "Lead"("stage");

-- AddForeignKey
ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceStepExecution" ADD CONSTRAINT "SequenceStepExecution_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "SequenceEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SequenceStepExecution" ADD CONSTRAINT "SequenceStepExecution_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "SequenceStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

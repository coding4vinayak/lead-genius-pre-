-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('openai', 'gemini', 'anthropic');

-- CreateEnum
CREATE TYPE "IntentCategory" AS ENUM ('interested', 'not_interested', 'out_of_office', 'meeting_request', 'pricing_question', 'feature_question', 'competitor_mention', 'spam', 'other');

-- AlterTable: Add missing columns to Lead
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "score" INTEGER;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "enrichmentData" JSONB;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "intentAnalysis" JSONB;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "currentStep" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "nextActionAt" TIMESTAMP(3);

-- AlterTable: Add missing columns to Message
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "isAiGenerated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "intentAnalysis" JSONB;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "draftReply" TEXT;

-- CreateTable: AgentSettings
CREATE TABLE "AgentSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "aiProvider" "AiProvider" NOT NULL DEFAULT 'openai',
    "aiModel" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "aiApiKey" TEXT,
    "aiBaseUrl" TEXT,
    "tone" TEXT NOT NULL DEFAULT 'professional',
    "autoReplyThreshold" INTEGER NOT NULL DEFAULT 70,
    "isAutoPilotActive" BOOLEAN NOT NULL DEFAULT false,
    "maxDailyReplies" INTEGER NOT NULL DEFAULT 50,
    "workingHoursStart" TEXT,
    "workingHoursEnd" TEXT,
    "humanHandoffRules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Lead score index
CREATE INDEX IF NOT EXISTS "Lead_score_idx" ON "Lead"("score");

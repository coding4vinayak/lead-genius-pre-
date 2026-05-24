-- AlterTable
ALTER TABLE "AgentSettings" ADD COLUMN "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AgentSettings" ADD COLUMN "reviewQueueEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AgentSettings" ADD COLUMN "excludedIntents" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "reviewStatus" TEXT;

-- CreateIndex
CREATE INDEX "Message_reviewStatus_idx" ON "Message"("reviewStatus");

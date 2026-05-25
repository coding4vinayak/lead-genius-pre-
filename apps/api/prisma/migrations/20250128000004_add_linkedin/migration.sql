-- CreateEnum
CREATE TYPE "LinkedInConnectionStatus" AS ENUM ('not_connected', 'pending', 'connected', 'declined');

-- AlterEnum
ALTER TYPE "Channel" ADD VALUE 'linkedin';

-- AlterEnum
ALTER TYPE "SequenceStepType" ADD VALUE 'send_connection_request';
ALTER TYPE "SequenceStepType" ADD VALUE 'send_linkedin_message';
ALTER TYPE "SequenceStepType" ADD VALUE 'view_profile';

-- CreateTable
CREATE TABLE "LinkedInProfile" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "profileUrl" TEXT NOT NULL,
    "headline" TEXT,
    "connectionStatus" "LinkedInConnectionStatus" NOT NULL DEFAULT 'not_connected',
    "connectionRequestedAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3),
    "lastMessagedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedInProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedInMessage" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkedInMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LinkedInProfile_leadId_key" ON "LinkedInProfile"("leadId");

-- CreateIndex
CREATE INDEX "LinkedInProfile_leadId_idx" ON "LinkedInProfile"("leadId");

-- CreateIndex
CREATE INDEX "LinkedInProfile_connectionStatus_idx" ON "LinkedInProfile"("connectionStatus");

-- CreateIndex
CREATE INDEX "LinkedInMessage_leadId_idx" ON "LinkedInMessage"("leadId");

-- CreateIndex
CREATE INDEX "LinkedInMessage_profileId_idx" ON "LinkedInMessage"("profileId");

-- CreateIndex
CREATE INDEX "LinkedInMessage_status_idx" ON "LinkedInMessage"("status");

-- AddForeignKey
ALTER TABLE "LinkedInProfile" ADD CONSTRAINT "LinkedInProfile_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedInMessage" ADD CONSTRAINT "LinkedInMessage_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "LinkedInProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

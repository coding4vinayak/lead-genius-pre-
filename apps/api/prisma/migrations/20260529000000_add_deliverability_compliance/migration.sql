-- CreateEnum
CREATE TYPE "EmailVerificationStatus" AS ENUM ('valid', 'invalid', 'risky', 'unknown');

-- CreateEnum
CREATE TYPE "SuppressionReason" AS ENUM ('bounce', 'unsubscribe', 'complaint');

-- CreateEnum
CREATE TYPE "GdprConsentType" AS ENUM ('marketing_email', 'marketing_sms', 'data_processing', 'third_party_sharing');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "verificationStatus" "EmailVerificationStatus";

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "physicalAddress" TEXT;

-- CreateTable
CREATE TABLE "EmailVerification" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "email" TEXT NOT NULL,
    "status" "EmailVerificationStatus" NOT NULL DEFAULT 'unknown',
    "mxValid" BOOLEAN NOT NULL DEFAULT false,
    "smtpValid" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuppressionEntry" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" "SuppressionReason" NOT NULL,
    "source" TEXT,
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuppressionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnsubscribeRecord" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "email" TEXT NOT NULL,
    "reason" TEXT,
    "unsubscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "token" TEXT,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnsubscribeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GdprConsent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "consentType" "GdprConsentType" NOT NULL,
    "source" TEXT,
    "givenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GdprConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailVerification_email_idx" ON "EmailVerification"("email");
CREATE INDEX "EmailVerification_leadId_idx" ON "EmailVerification"("leadId");
CREATE INDEX "EmailVerification_status_idx" ON "EmailVerification"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SuppressionEntry_email_reason_key" ON "SuppressionEntry"("email", "reason");
CREATE INDEX "SuppressionEntry_email_idx" ON "SuppressionEntry"("email");
CREATE INDEX "SuppressionEntry_reason_idx" ON "SuppressionEntry"("reason");
CREATE INDEX "SuppressionEntry_campaignId_idx" ON "SuppressionEntry"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "UnsubscribeRecord_token_key" ON "UnsubscribeRecord"("token");
CREATE INDEX "UnsubscribeRecord_email_idx" ON "UnsubscribeRecord"("email");
CREATE INDEX "UnsubscribeRecord_leadId_idx" ON "UnsubscribeRecord"("leadId");
CREATE INDEX "UnsubscribeRecord_token_idx" ON "UnsubscribeRecord"("token");

-- CreateIndex
CREATE UNIQUE INDEX "GdprConsent_leadId_consentType_key" ON "GdprConsent"("leadId", "consentType");
CREATE INDEX "GdprConsent_leadId_idx" ON "GdprConsent"("leadId");
CREATE INDEX "GdprConsent_consentType_idx" ON "GdprConsent"("consentType");

-- CreateIndex
CREATE INDEX "Lead_verificationStatus_idx" ON "Lead"("verificationStatus");

-- AddForeignKey
ALTER TABLE "EmailVerification" ADD CONSTRAINT "EmailVerification_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnsubscribeRecord" ADD CONSTRAINT "UnsubscribeRecord_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GdprConsent" ADD CONSTRAINT "GdprConsent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

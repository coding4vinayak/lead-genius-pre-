-- CreateEnum
CREATE TYPE "RotationStrategy" AS ENUM ('round_robin', 'weighted', 'failover');

-- CreateEnum
CREATE TYPE "TrackingDomainStatus" AS ENUM ('pending', 'verified', 'failed');

-- CreateTable
CREATE TABLE "EmailAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpPass" TEXT,
    "sendgridApiKey" TEXT,
    "dailyLimit" INTEGER NOT NULL DEFAULT 100,
    "sentToday" INTEGER NOT NULL DEFAULT 0,
    "warmupStatus" "WarmupStatus" NOT NULL DEFAULT 'warming',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "reputationScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "bounceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingDomain" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "cnameTarget" TEXT NOT NULL,
    "cnameVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" "TrackingDomainStatus" NOT NULL DEFAULT 'pending',
    "verifiedAt" TIMESTAMP(3),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackingDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountRotationConfig" (
    "id" TEXT NOT NULL,
    "strategy" "RotationStrategy" NOT NULL DEFAULT 'round_robin',
    "weights" JSONB,
    "skipOnDailyLimit" BOOLEAN NOT NULL DEFAULT true,
    "skipOnHighBounce" BOOLEAN NOT NULL DEFAULT true,
    "bounceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountRotationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailAccount_email_key" ON "EmailAccount"("email");
CREATE INDEX "EmailAccount_email_idx" ON "EmailAccount"("email");
CREATE INDEX "EmailAccount_isActive_idx" ON "EmailAccount"("isActive");
CREATE INDEX "EmailAccount_warmupStatus_idx" ON "EmailAccount"("warmupStatus");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingDomain_domain_key" ON "TrackingDomain"("domain");
CREATE INDEX "TrackingDomain_domain_idx" ON "TrackingDomain"("domain");
CREATE INDEX "TrackingDomain_isDefault_idx" ON "TrackingDomain"("isDefault");

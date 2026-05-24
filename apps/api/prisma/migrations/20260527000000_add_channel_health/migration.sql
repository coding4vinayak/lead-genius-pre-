-- CreateTable
CREATE TABLE "ChannelHealth" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'healthy',
    "dailySent" INTEGER NOT NULL DEFAULT 0,
    "dailyBounced" INTEGER NOT NULL DEFAULT 0,
    "dailyComplaints" INTEGER NOT NULL DEFAULT 0,
    "deliveryRate" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "bounceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastErrorMessage" TEXT,
    "quotaUsed" INTEGER NOT NULL DEFAULT 0,
    "quotaLimit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelHealth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "category" TEXT NOT NULL DEFAULT 'marketing',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "body" TEXT NOT NULL,
    "headerType" TEXT,
    "headerContent" TEXT,
    "footerText" TEXT,
    "buttons" JSONB,
    "twilioTemplateSid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDomainAuth" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "spfStatus" TEXT NOT NULL DEFAULT 'pending',
    "dkimStatus" TEXT NOT NULL DEFAULT 'pending',
    "dmarcStatus" TEXT NOT NULL DEFAULT 'pending',
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDomainAuth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChannelHealth_channel_idx" ON "ChannelHealth"("channel");

-- CreateIndex
CREATE INDEX "ChannelHealth_status_idx" ON "ChannelHealth"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelHealth_channel_provider_key" ON "ChannelHealth"("channel", "provider");

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_status_idx" ON "WhatsAppTemplate"("status");

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_category_idx" ON "WhatsAppTemplate"("category");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDomainAuth_domain_key" ON "EmailDomainAuth"("domain");

-- CreateIndex
CREATE INDEX "EmailDomainAuth_domain_idx" ON "EmailDomainAuth"("domain");

-- CreateEnum
CREATE TYPE "CrmProvider" AS ENUM ('hubspot', 'salesforce');

-- CreateEnum
CREATE TYPE "CrmSyncDirection" AS ENUM ('inbound', 'outbound', 'bidirectional');

-- CreateEnum
CREATE TYPE "CrmSyncStatus" AS ENUM ('idle', 'syncing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('scheduled', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "RecipeCategory" AS ENUM ('lead_management', 'email_campaigns', 'notifications', 'data_sync', 'reporting');

-- CreateTable
CREATE TABLE "CrmSync" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'bidirectional',
    "lastSyncAt" TIMESTAMP(3),
    "syncStatus" TEXT NOT NULL DEFAULT 'idle',
    "fieldMapping" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarBooking" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "meetingLink" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "bookedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlackNotification" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "eventTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlackNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "triggerEvents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetUrl" TEXT NOT NULL,
    "headers" JSONB,
    "bodyTemplate" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmSync_integrationId_idx" ON "CrmSync"("integrationId");

-- CreateIndex
CREATE INDEX "CalendarBooking_leadId_idx" ON "CalendarBooking"("leadId");

-- CreateIndex
CREATE INDEX "CalendarBooking_status_idx" ON "CalendarBooking"("status");

-- CreateIndex
CREATE INDEX "SlackNotification_integrationId_idx" ON "SlackNotification"("integrationId");

-- CreateIndex
CREATE INDEX "WebhookTemplate_category_idx" ON "WebhookTemplate"("category");

-- CreateIndex
CREATE INDEX "Recipe_category_idx" ON "Recipe"("category");

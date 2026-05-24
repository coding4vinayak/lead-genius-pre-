-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('active', 'inactive', 'draft');

-- CreateEnum
CREATE TYPE "AutomationTriggerType" AS ENUM ('lead.created', 'lead.updated', 'lead.field_changed', 'lead.tag_added', 'lead.tag_removed', 'lead.score_threshold', 'message.received', 'message.sent', 'message.bounced', 'campaign.activated', 'campaign.paused', 'campaign.completed', 'webhook.received', 'cron', 'manual');

-- CreateEnum
CREATE TYPE "AutomationStepType" AS ENUM ('send_message', 'update_lead_field', 'add_tag', 'remove_tag', 'move_to_group', 'remove_from_group', 'pause_campaign', 'send_webhook', 'delay', 'condition', 'create_task');

-- CreateEnum
CREATE TYPE "AutomationExecutionStatus" AS ENUM ('running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('pending', 'delivered', 'failed');

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('slack', 'hubspot', 'salesforce', 'zapier', 'n8n', 'custom');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateTable
CREATE TABLE "Automation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerType" "AutomationTriggerType" NOT NULL,
    "triggerConfig" JSONB NOT NULL DEFAULT '{}',
    "status" "AutomationStatus" NOT NULL DEFAULT 'draft',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationStep" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "type" "AutomationStepType" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL,
    "nextStepId" TEXT,
    "conditionTrueStepId" TEXT,
    "conditionFalseStepId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationExecution" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "triggerPayload" JSONB,
    "status" "AutomationExecutionStatus" NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationExecutionStep" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "status" "AutomationExecutionStatus" NOT NULL DEFAULT 'running',
    "input" JSONB,
    "output" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "AutomationExecutionStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookSubscription" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "secret" TEXT,
    "headers" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextRetryAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundWebhook" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "token" TEXT NOT NULL,
    "automationId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "credentials" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeId" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
    "dueDate" TIMESTAMP(3),
    "automationId" TEXT,
    "automationExecutionId" TEXT,
    "metadata" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Automation_status_idx" ON "Automation"("status");

-- CreateIndex
CREATE INDEX "Automation_triggerType_idx" ON "Automation"("triggerType");

-- CreateIndex
CREATE INDEX "Automation_isActive_idx" ON "Automation"("isActive");

-- CreateIndex
CREATE INDEX "AutomationStep_automationId_idx" ON "AutomationStep"("automationId");

-- CreateIndex
CREATE INDEX "AutomationStep_position_idx" ON "AutomationStep"("position");

-- CreateIndex
CREATE INDEX "AutomationExecution_automationId_idx" ON "AutomationExecution"("automationId");

-- CreateIndex
CREATE INDEX "AutomationExecution_status_idx" ON "AutomationExecution"("status");

-- CreateIndex
CREATE INDEX "AutomationExecution_startedAt_idx" ON "AutomationExecution"("startedAt");

-- CreateIndex
CREATE INDEX "AutomationExecutionStep_executionId_idx" ON "AutomationExecutionStep"("executionId");

-- CreateIndex
CREATE INDEX "AutomationExecutionStep_stepId_idx" ON "AutomationExecutionStep"("stepId");

-- CreateIndex
CREATE INDEX "Event_type_idx" ON "Event"("type");

-- CreateIndex
CREATE INDEX "Event_entityType_entityId_idx" ON "Event"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Event_createdAt_idx" ON "Event"("createdAt");

-- CreateIndex
CREATE INDEX "WebhookSubscription_isActive_idx" ON "WebhookSubscription"("isActive");

-- CreateIndex
CREATE INDEX "WebhookDelivery_webhookId_idx" ON "WebhookDelivery"("webhookId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_idx" ON "WebhookDelivery"("status");

-- CreateIndex
CREATE INDEX "WebhookDelivery_nextRetryAt_idx" ON "WebhookDelivery"("nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX "InboundWebhook_token_key" ON "InboundWebhook"("token");

-- CreateIndex
CREATE INDEX "InboundWebhook_token_idx" ON "InboundWebhook"("token");

-- CreateIndex
CREATE INDEX "InboundWebhook_isActive_idx" ON "InboundWebhook"("isActive");

-- CreateIndex
CREATE INDEX "Integration_type_idx" ON "Integration"("type");

-- CreateIndex
CREATE INDEX "Integration_isActive_idx" ON "Integration"("isActive");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_priority_idx" ON "Task"("priority");

-- CreateIndex
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");

-- CreateIndex
CREATE INDEX "Task_automationId_idx" ON "Task"("automationId");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- AlterTable
ALTER TABLE "InboundWebhook" ADD COLUMN "secret" TEXT;

-- AddForeignKey
ALTER TABLE "AutomationStep" ADD CONSTRAINT "AutomationStep_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecutionStep" ADD CONSTRAINT "AutomationExecutionStep_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AutomationExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecutionStep" ADD CONSTRAINT "AutomationExecutionStep_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "AutomationStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "WebhookSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundWebhook" ADD CONSTRAINT "InboundWebhook_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

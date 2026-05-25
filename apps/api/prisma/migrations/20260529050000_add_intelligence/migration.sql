-- CreateTable
CREATE TABLE "AbTest" (
    "id" TEXT NOT NULL,
    "sequenceStepId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "winnerVariantId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbTestVariant" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 50,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbTestVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SendTimePreference" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "preferredHour" INTEGER,
    "preferredDay" INTEGER,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "dataPoints" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SendTimePreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsSnapshot" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceBenchmark" (
    "id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "industryAverage" DOUBLE PRECISION NOT NULL,
    "userValue" DOUBLE PRECISION NOT NULL,
    "percentile" DOUBLE PRECISION NOT NULL,
    "suggestions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceBenchmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AbTest_sequenceStepId_idx" ON "AbTest"("sequenceStepId");

-- CreateIndex
CREATE INDEX "AbTest_status_idx" ON "AbTest"("status");

-- CreateIndex
CREATE INDEX "AbTestVariant_testId_idx" ON "AbTestVariant"("testId");

-- CreateIndex
CREATE UNIQUE INDEX "SendTimePreference_leadId_key" ON "SendTimePreference"("leadId");

-- CreateIndex
CREATE INDEX "SendTimePreference_timezone_idx" ON "SendTimePreference"("timezone");

-- CreateIndex
CREATE INDEX "AnalyticsSnapshot_type_entityId_idx" ON "AnalyticsSnapshot"("type", "entityId");

-- CreateIndex
CREATE INDEX "AnalyticsSnapshot_periodStart_periodEnd_idx" ON "AnalyticsSnapshot"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "PerformanceBenchmark_metric_idx" ON "PerformanceBenchmark"("metric");

-- AddForeignKey
ALTER TABLE "AbTestVariant" ADD CONSTRAINT "AbTestVariant_testId_fkey" FOREIGN KEY ("testId") REFERENCES "AbTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

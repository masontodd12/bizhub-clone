-- CreateTable
CREATE TABLE "FeatureUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeatureUsage_userId_feature_day_idx" ON "FeatureUsage"("userId", "feature", "day");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureUsage_userId_feature_day_key" ON "FeatureUsage"("userId", "feature", "day");

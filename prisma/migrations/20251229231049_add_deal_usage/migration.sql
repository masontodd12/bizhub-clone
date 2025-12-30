/*
  Warnings:

  - The `plan` column on the `UserAccess` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `subscriptionStatus` column on the `UserAccess` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[stripeCustomerId]` on the table `UserAccess` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeSubscriptionId]` on the table `UserAccess` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('free', 'pro', 'pro_plus');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('none', 'trialing', 'active', 'past_due', 'canceled');

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "userAccessId" TEXT;

-- AlterTable
ALTER TABLE "UserAccess" ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "stripePriceId" TEXT,
DROP COLUMN "plan",
ADD COLUMN     "plan" "Plan" NOT NULL DEFAULT 'free',
DROP COLUMN "subscriptionStatus",
ADD COLUMN     "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'none';

-- CreateTable
CREATE TABLE "DealUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealUsage_userId_idx" ON "DealUsage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DealUsage_userId_date_key" ON "DealUsage"("userId", "date");

-- CreateIndex
CREATE INDEX "Deal_createdAt_idx" ON "Deal"("createdAt");

-- CreateIndex
CREATE INDEX "Deal_userAccessId_idx" ON "Deal"("userAccessId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAccess_stripeCustomerId_key" ON "UserAccess"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAccess_stripeSubscriptionId_key" ON "UserAccess"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "UserAccess_plan_idx" ON "UserAccess"("plan");

-- CreateIndex
CREATE INDEX "UserAccess_subscriptionStatus_idx" ON "UserAccess"("subscriptionStatus");

-- CreateIndex
CREATE INDEX "UserAccess_trialEndsAt_idx" ON "UserAccess"("trialEndsAt");

-- CreateIndex
CREATE INDEX "UserAccess_stripeCustomerId_idx" ON "UserAccess"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "UserAccess_stripeSubscriptionId_idx" ON "UserAccess"("stripeSubscriptionId");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_userAccessId_fkey" FOREIGN KEY ("userAccessId") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

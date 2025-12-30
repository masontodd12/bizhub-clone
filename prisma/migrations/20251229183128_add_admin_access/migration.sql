-- DropIndex
DROP INDEX "UserAccess_plan_idx";

-- DropIndex
DROP INDEX "UserAccess_stripeCustomerId_idx";

-- DropIndex
DROP INDEX "UserAccess_stripeSubscriptionId_idx";

-- DropIndex
DROP INDEX "UserAccess_subscriptionStatus_idx";

-- AlterTable
ALTER TABLE "UserAccess" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;

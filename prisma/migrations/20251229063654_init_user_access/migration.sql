-- AlterTable
ALTER TABLE "UserAccess" ADD COLUMN     "hasUsedTrial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subscriptionStatus" TEXT;

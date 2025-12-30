-- AlterTable
ALTER TABLE "UserAccess" ADD COLUMN     "email" TEXT,
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "UserAccess_email_idx" ON "UserAccess"("email");

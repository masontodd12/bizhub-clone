-- CreateIndex
CREATE INDEX "UserAccess_plan_idx" ON "UserAccess"("plan");

-- CreateIndex
CREATE INDEX "UserAccess_subscriptionStatus_idx" ON "UserAccess"("subscriptionStatus");

-- CreateIndex
CREATE INDEX "UserAccess_stripeCustomerId_idx" ON "UserAccess"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "UserAccess_stripeSubscriptionId_idx" ON "UserAccess"("stripeSubscriptionId");

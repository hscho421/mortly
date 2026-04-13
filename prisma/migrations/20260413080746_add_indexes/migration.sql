-- CreateIndex
CREATE INDEX "brokers_subscriptionTier_idx" ON "brokers"("subscriptionTier");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

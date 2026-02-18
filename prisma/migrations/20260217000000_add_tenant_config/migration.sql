-- CreateTable
CREATE TABLE "tenant_config" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenantSlug" TEXT NOT NULL,
    "tenantName" TEXT NOT NULL,
    "enabledModules" TEXT[],
    "maxUsers" INTEGER NOT NULL DEFAULT 5,
    "planType" TEXT NOT NULL DEFAULT 'STARTER',
    "logoUrl" TEXT,
    "primaryColor" TEXT DEFAULT '#000000',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_config_tenantSlug_key" ON "tenant_config"("tenantSlug");

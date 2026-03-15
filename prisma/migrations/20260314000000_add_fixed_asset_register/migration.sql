-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('STRAIGHT_LINE', 'DECLINING_BALANCE', 'UNITS_OF_PRODUCTION');

-- CreateEnum
CREATE TYPE "DepreciationFrequency" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'FULLY_DEPRECIATED', 'DISPOSED', 'SOLD', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "AssetMovementType" AS ENUM ('DISPOSAL', 'SALE', 'WRITE_OFF', 'TRANSFER');

-- CreateEnum
CREATE TYPE "DepreciationRunStatus" AS ENUM ('PREVIEW', 'POSTED', 'REVERSED');

-- CreateTable
CREATE TABLE "fixed_asset_categories" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultMethod" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "defaultUsefulLife" INTEGER NOT NULL DEFAULT 60,
    "defaultResidualPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "assetAccountId" UUID,
    "accDepAccountId" UUID,
    "depExpAccountId" UUID,
    "gainLossAccountId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixed_asset_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixed_assets" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "assetCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" UUID NOT NULL,
    "purchaseDate" DATE NOT NULL,
    "capitalizationDate" DATE NOT NULL,
    "supplierId" UUID,
    "purchaseCost" DECIMAL(15,2) NOT NULL,
    "residualValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "usefulLifeMonths" INTEGER NOT NULL,
    "depreciationMethod" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "depreciationFrequency" "DepreciationFrequency" NOT NULL DEFAULT 'MONTHLY',
    "depreciationStartDate" DATE NOT NULL,
    "accumulatedDepreciation" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "netBookValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "location" TEXT,
    "department" TEXT,
    "serialNumber" TEXT,
    "notes" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixed_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixed_asset_deprec_schedules" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "assetId" UUID NOT NULL,
    "periodNo" INTEGER NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "depreciationAmount" DECIMAL(15,2) NOT NULL,
    "accumulatedAmount" DECIMAL(15,2) NOT NULL,
    "bookValueAfter" DECIMAL(15,2) NOT NULL,
    "isPosted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "fixed_asset_deprec_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixed_asset_deprec_runs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "runDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "DepreciationRunStatus" NOT NULL DEFAULT 'PREVIEW',
    "totalAssets" INTEGER NOT NULL,
    "totalDepreciation" DECIMAL(15,2) NOT NULL,
    "postedBy" UUID,
    "postedAt" TIMESTAMP(3),
    "reversedBy" UUID,
    "reversedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixed_asset_deprec_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixed_asset_deprec_entries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "runId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "depreciationAmount" DECIMAL(15,2) NOT NULL,
    "accumulatedAfter" DECIMAL(15,2) NOT NULL,
    "bookValueAfter" DECIMAL(15,2) NOT NULL,
    "journalEntryId" UUID,

    CONSTRAINT "fixed_asset_deprec_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixed_asset_movements" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "assetId" UUID NOT NULL,
    "type" "AssetMovementType" NOT NULL,
    "date" DATE NOT NULL,
    "proceeds" DECIMAL(15,2),
    "gainLoss" DECIMAL(15,2),
    "fromLocation" TEXT,
    "fromDepartment" TEXT,
    "toLocation" TEXT,
    "toDepartment" TEXT,
    "notes" TEXT,
    "journalEntryId" UUID,
    "executedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fixed_asset_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fixed_asset_categories_code_key" ON "fixed_asset_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "fixed_assets_assetCode_key" ON "fixed_assets"("assetCode");

-- CreateIndex
CREATE INDEX "fixed_assets_categoryId_idx" ON "fixed_assets"("categoryId");

-- CreateIndex
CREATE INDEX "fixed_assets_status_idx" ON "fixed_assets"("status");

-- CreateIndex
CREATE INDEX "fixed_assets_supplierId_idx" ON "fixed_assets"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "fixed_asset_deprec_schedules_assetId_periodNo_key" ON "fixed_asset_deprec_schedules"("assetId", "periodNo");

-- CreateIndex
CREATE INDEX "fixed_asset_deprec_schedules_assetId_idx" ON "fixed_asset_deprec_schedules"("assetId");

-- CreateIndex
CREATE INDEX "fixed_asset_deprec_schedules_scheduledDate_idx" ON "fixed_asset_deprec_schedules"("scheduledDate");

-- CreateIndex
CREATE INDEX "fixed_asset_deprec_runs_status_idx" ON "fixed_asset_deprec_runs"("status");

-- CreateIndex
CREATE INDEX "fixed_asset_deprec_runs_periodStart_periodEnd_idx" ON "fixed_asset_deprec_runs"("periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "fixed_asset_deprec_entries_runId_assetId_key" ON "fixed_asset_deprec_entries"("runId", "assetId");

-- CreateIndex
CREATE INDEX "fixed_asset_deprec_entries_runId_idx" ON "fixed_asset_deprec_entries"("runId");

-- CreateIndex
CREATE INDEX "fixed_asset_deprec_entries_assetId_idx" ON "fixed_asset_deprec_entries"("assetId");

-- CreateIndex
CREATE INDEX "fixed_asset_movements_assetId_idx" ON "fixed_asset_movements"("assetId");

-- CreateIndex
CREATE INDEX "fixed_asset_movements_type_idx" ON "fixed_asset_movements"("type");

-- AddForeignKey
ALTER TABLE "fixed_asset_categories" ADD CONSTRAINT "fixed_asset_categories_assetAccountId_fkey" FOREIGN KEY ("assetAccountId") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_asset_categories" ADD CONSTRAINT "fixed_asset_categories_accDepAccountId_fkey" FOREIGN KEY ("accDepAccountId") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_asset_categories" ADD CONSTRAINT "fixed_asset_categories_depExpAccountId_fkey" FOREIGN KEY ("depExpAccountId") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_asset_categories" ADD CONSTRAINT "fixed_asset_categories_gainLossAccountId_fkey" FOREIGN KEY ("gainLossAccountId") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "fixed_asset_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_asset_deprec_schedules" ADD CONSTRAINT "fixed_asset_deprec_schedules_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "fixed_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_asset_deprec_entries" ADD CONSTRAINT "fixed_asset_deprec_entries_runId_fkey" FOREIGN KEY ("runId") REFERENCES "fixed_asset_deprec_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_asset_deprec_entries" ADD CONSTRAINT "fixed_asset_deprec_entries_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "fixed_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_asset_deprec_entries" ADD CONSTRAINT "fixed_asset_deprec_entries_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_asset_movements" ADD CONSTRAINT "fixed_asset_movements_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "fixed_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_asset_movements" ADD CONSTRAINT "fixed_asset_movements_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

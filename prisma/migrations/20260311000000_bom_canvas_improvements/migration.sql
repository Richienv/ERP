-- AlterTable: Add draftSnapshot and draftUpdatedAt to production_boms
ALTER TABLE "production_boms" ADD COLUMN "draftSnapshot" JSONB,
                              ADD COLUMN "draftUpdatedAt" TIMESTAMP(3);

-- AlterTable: Add snapshotCostPrice to production_bom_items
ALTER TABLE "production_bom_items" ADD COLUMN "snapshotCostPrice" DECIMAL(12,4);

-- CreateTable: BOM Templates
CREATE TABLE "bom_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stepsJson" JSONB NOT NULL,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bom_templates_pkey" PRIMARY KEY ("id")
);

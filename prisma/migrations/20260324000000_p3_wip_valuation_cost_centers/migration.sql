-- P3.1: WIP Valuation fields on WorkOrder
ALTER TABLE "work_orders" ADD COLUMN "completionPct" DECIMAL(5,2);
ALTER TABLE "work_orders" ADD COLUMN "wipValue" DECIMAL(15,2);
ALTER TABLE "work_orders" ADD COLUMN "lastWIPValuationDate" TIMESTAMP(3);

-- P3.2: Cost Center model
CREATE TABLE "cost_centers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- Cost Center on JournalLine
ALTER TABLE "journal_lines" ADD COLUMN "costCenterId" UUID;

-- Cost Center on BudgetLine
ALTER TABLE "budget_lines" ADD COLUMN "costCenterId" UUID;

-- Unique constraint and indexes
CREATE UNIQUE INDEX "cost_centers_code_key" ON "cost_centers"("code");
CREATE INDEX "cost_centers_type_idx" ON "cost_centers"("type");
CREATE INDEX "journal_lines_costCenterId_idx" ON "journal_lines"("costCenterId");
CREATE INDEX "budget_lines_costCenterId_idx" ON "budget_lines"("costCenterId");

-- Foreign keys
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN "estimatedCostTotal" DECIMAL(15, 2),
ADD COLUMN "actualCostTotal" DECIMAL(15, 2),
ADD COLUMN "costVariancePct" DECIMAL(8, 2);

-- AlterTable
ALTER TABLE "process_stations" ADD COLUMN "overheadPct" DECIMAL(5, 2);

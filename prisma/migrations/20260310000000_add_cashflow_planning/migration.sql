-- CreateEnum
CREATE TYPE "CashflowDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "CashflowCategory" AS ENUM ('AR_INVOICE', 'AP_BILL', 'PAYROLL', 'BPJS', 'PETTY_CASH', 'RECURRING_JOURNAL', 'BUDGET_ALLOCATION', 'MANUAL', 'RECURRING_EXPENSE', 'RECURRING_INCOME');

-- CreateTable
CREATE TABLE "cashflow_plan_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "direction" "CashflowDirection" NOT NULL,
    "category" "CashflowCategory" NOT NULL DEFAULT 'MANUAL',
    "glAccountId" UUID,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringPattern" TEXT,
    "recurringEndDate" DATE,
    "notes" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cashflow_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cashflow_snapshots" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "startingBalance" DECIMAL(18,2) NOT NULL,
    "startingBalanceOverride" DECIMAL(18,2),
    "items" JSONB NOT NULL,
    "totalPlannedIn" DECIMAL(18,2) NOT NULL,
    "totalPlannedOut" DECIMAL(18,2) NOT NULL,
    "plannedEndBalance" DECIMAL(18,2) NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cashflow_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cashflow_plan_items_date_idx" ON "cashflow_plan_items"("date");

-- CreateIndex
CREATE INDEX "cashflow_plan_items_direction_idx" ON "cashflow_plan_items"("direction");

-- CreateIndex
CREATE INDEX "cashflow_plan_items_category_idx" ON "cashflow_plan_items"("category");

-- CreateIndex
CREATE UNIQUE INDEX "cashflow_snapshots_month_year_key" ON "cashflow_snapshots"("month", "year");

-- AddForeignKey
ALTER TABLE "cashflow_plan_items" ADD CONSTRAINT "cashflow_plan_items_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

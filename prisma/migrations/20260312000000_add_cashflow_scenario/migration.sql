-- CreateTable
CREATE TABLE "CashflowScenario" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "totalIn" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "totalOut" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "netFlow" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashflowScenario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashflowScenario_month_year_idx" ON "CashflowScenario"("month", "year");

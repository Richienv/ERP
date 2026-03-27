-- CreateEnum
CREATE TYPE "PPhType" AS ENUM ('PPH_21', 'PPH_23', 'PPH_4_2');

-- CreateEnum
CREATE TYPE "WithholdingDirection" AS ENUM ('OUT', 'IN');

-- CreateTable
CREATE TABLE "withholding_taxes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "paymentId" UUID NOT NULL,
    "invoiceId" UUID,
    "type" "PPhType" NOT NULL,
    "direction" "WithholdingDirection" NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "baseAmount" DECIMAL(15,2) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "buktiPotongNo" TEXT,
    "buktiPotongDate" TIMESTAMP(3),
    "deposited" BOOLEAN NOT NULL DEFAULT false,
    "depositDate" TIMESTAMP(3),
    "depositRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "withholding_taxes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "withholding_taxes_type_deposited_idx" ON "withholding_taxes"("type", "deposited");

-- CreateIndex
CREATE INDEX "withholding_taxes_paymentId_idx" ON "withholding_taxes"("paymentId");

-- AddForeignKey
ALTER TABLE "withholding_taxes" ADD CONSTRAINT "withholding_taxes_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withholding_taxes" ADD CONSTRAINT "withholding_taxes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Add multi-currency fields to invoices
ALTER TABLE "invoices" ADD COLUMN "currencyCode" TEXT NOT NULL DEFAULT 'IDR';
ALTER TABLE "invoices" ADD COLUMN "exchangeRate" DECIMAL(15,4) NOT NULL DEFAULT 1;
ALTER TABLE "invoices" ADD COLUMN "amountInIDR" DECIMAL(15,2) NOT NULL DEFAULT 0;

-- AlterTable: Add multi-currency fields to quotations
ALTER TABLE "quotations" ADD COLUMN "currencyCode" TEXT NOT NULL DEFAULT 'IDR';
ALTER TABLE "quotations" ADD COLUMN "exchangeRate" DECIMAL(15,4) NOT NULL DEFAULT 1;

-- AlterTable: Add multi-currency fields to sales_orders
ALTER TABLE "sales_orders" ADD COLUMN "currencyCode" TEXT NOT NULL DEFAULT 'IDR';
ALTER TABLE "sales_orders" ADD COLUMN "exchangeRate" DECIMAL(15,4) NOT NULL DEFAULT 1;

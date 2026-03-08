-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "returnedQty" INTEGER NOT NULL DEFAULT 0;

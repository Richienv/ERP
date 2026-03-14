-- AlterTable
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "purchaseRequestId" UUID;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

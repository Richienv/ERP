-- One import: a purchase can start from our own PO/CO (no supplier invoice yet).
ALTER TABLE "supplier_invoice_captures" ALTER COLUMN "supplierInvoiceNo" DROP NOT NULL;
ALTER TABLE "supplier_invoice_captures" ADD COLUMN IF NOT EXISTS "poDocumentNo" TEXT;
CREATE INDEX IF NOT EXISTS "supplier_invoice_captures_poDocumentNo_idx" ON "supplier_invoice_captures"("poDocumentNo");

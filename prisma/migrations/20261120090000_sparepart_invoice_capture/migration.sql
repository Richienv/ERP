-- Spare-part purchasing: supplier invoice capture + learned supplier templates.
-- Additive only: two new tables, no change to existing tables.


-- CreateTable
CREATE TABLE IF NOT EXISTS "supplier_invoice_captures" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "line" TEXT NOT NULL DEFAULT 'SPAREPART',
    "purchaseOrderId" UUID NOT NULL,
    "billId" UUID,
    "supplierId" UUID NOT NULL,
    "supplierInvoiceNo" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paymentTerms" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'IDR',
    "exchangeRate" DECIMAL(15,4) NOT NULL DEFAULT 1,
    "subtotalOriginal" DECIMAL(20,2) NOT NULL,
    "taxOriginal" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "totalOriginal" DECIMAL(20,2) NOT NULL,
    "fileName" TEXT,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "fileSha256" TEXT,
    "storagePath" TEXT,
    "parseMethod" TEXT NOT NULL DEFAULT 'MANUAL',
    "parseMs" INTEGER,
    "parseConfidence" DECIMAL(4,3),
    "parsed" JSONB,
    "shippedAt" TIMESTAMP(3),
    "trackingNumber" TEXT,
    "eta" TIMESTAMP(3),
    "searchText" TEXT NOT NULL DEFAULT '',
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_invoice_captures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "supplier_invoice_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "supplierId" UUID NOT NULL,
    "fingerprint" JSONB NOT NULL,
    "template" JSONB NOT NULL,
    "samples" INTEGER NOT NULL DEFAULT 1,
    "lastRate" DECIMAL(15,4),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_invoice_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_invoice_captures_purchaseOrderId_key" ON "supplier_invoice_captures"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_invoice_captures_billId_key" ON "supplier_invoice_captures"("billId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "supplier_invoice_captures_line_createdAt_id_idx" ON "supplier_invoice_captures"("line", "createdAt" DESC, "id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "supplier_invoice_captures_fileSha256_idx" ON "supplier_invoice_captures"("fileSha256");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_invoice_captures_supplierId_supplierInvoiceNo_key" ON "supplier_invoice_captures"("supplierId", "supplierInvoiceNo");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_invoice_templates_supplierId_key" ON "supplier_invoice_templates"("supplierId");

-- AddForeignKey
ALTER TABLE "supplier_invoice_captures" ADD CONSTRAINT "supplier_invoice_captures_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice_captures" ADD CONSTRAINT "supplier_invoice_captures_billId_fkey" FOREIGN KEY ("billId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice_captures" ADD CONSTRAINT "supplier_invoice_captures_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice_templates" ADD CONSTRAINT "supplier_invoice_templates_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Search: one trigram index over PO number, supplier, invoice number and part codes,
-- so "2304a078" or "ruixiang" finds a purchase with a single index scan.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "supplier_invoice_captures_searchText_trgm_idx"
    ON "supplier_invoice_captures" USING GIN ("searchText" gin_trgm_ops);

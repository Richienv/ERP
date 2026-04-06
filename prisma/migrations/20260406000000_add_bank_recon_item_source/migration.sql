-- AddColumn: source field to BankReconciliationItem
ALTER TABLE "bank_reconciliation_items" ADD COLUMN "source" TEXT;

-- AddIndex: index on source for filtering GL_AUTO vs CSV_IMPORT items
CREATE INDEX "bank_reconciliation_items_source_idx" ON "bank_reconciliation_items"("source");

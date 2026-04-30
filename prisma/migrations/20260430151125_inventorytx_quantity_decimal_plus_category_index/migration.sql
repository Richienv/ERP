-- Note: applied via `prisma migrate deploy` rather than `migrate dev` due to
-- pre-existing P3006 on older add_po_events shadow-DB replay. Same workaround
-- as 20260430052555_inventory_perf_indexes and 20260430142036_add_adjustment_reasons.

-- Bug A (CRITICAL): align InventoryTransaction.quantity with StockLevel.quantity.
-- Existing Int values are valid Decimals; ALTER TYPE preserves them.
ALTER TABLE "inventory_transactions"
    ALTER COLUMN "quantity" TYPE DECIMAL(18, 4) USING "quantity"::DECIMAL(18, 4);

-- Bug B: Category.isActive seq-scan fix.
CREATE INDEX IF NOT EXISTS "categories_isActive_idx" ON "categories"("isActive");

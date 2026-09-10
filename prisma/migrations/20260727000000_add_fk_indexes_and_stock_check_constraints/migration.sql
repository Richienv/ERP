-- =============================================================================
-- Missing FK indexes + non-negative stock CHECK constraints
-- =============================================================================
--
-- PART 1 — FOREIGN KEY INDEXES
--
-- PostgreSQL does NOT automatically create an index on the *referencing* side
-- of a foreign key (it only indexes the referenced PK/unique side). Every
-- column below is an FK (or an FK-shaped reference column) that was joined or
-- filtered in hot report / traceability paths with no supporting index, i.e.
-- a sequential scan on every lookup. All indexes here mirror @@index([...])
-- declarations added to prisma/schema.prisma in the same change, and follow
-- Prisma's generated naming convention "<table>_<column>_idx" so that a later
-- `prisma migrate diff` reports no drift.
--
-- LOCKING NOTE: plain CREATE INDEX takes a SHARE lock, which blocks writes
-- (not reads) on the table while the index builds. CREATE INDEX CONCURRENTLY
-- is deliberately NOT used because Prisma wraps each migration in a single
-- transaction and CONCURRENTLY cannot run inside a transaction block. On the
-- current data volumes these builds are sub-second. If a table has grown large
-- by the time this is deployed, the operator may instead run the equivalent
-- CREATE INDEX CONCURRENTLY statements by hand outside of migrate and then
-- mark this migration as applied with `prisma migrate resolve --applied`.
--
--
-- PART 2 — NON-NEGATIVE STOCK CHECK CONSTRAINTS
--
-- There were previously NO CHECK constraints anywhere in this database. Stock
-- quantities could go negative through unguarded decrements (e.g.
-- lib/actions/stock-transfers.ts uses `availableQty: { increment: -qty }` with
-- no floor), which silently corrupts inventory valuation and every downstream
-- report.
--
-- WHY "NOT VALID":
-- `ALTER TABLE ... ADD CONSTRAINT ... CHECK (...)` normally performs a full
-- table scan and ABORTS THE ENTIRE MIGRATION if even one pre-existing row
-- violates the predicate. Because this is being deployed against live
-- production data that has never been guarded, we cannot assume the data is
-- already clean — a validating ADD CONSTRAINT is a coin-flip on whether the
-- deploy succeeds.
--
-- `NOT VALID` gives us the safe half of the behaviour:
--   * The constraint IS enforced on every INSERT and UPDATE from this moment
--     on, so no NEW negative stock can be written. The bug stops today.
--   * Existing rows are NOT scanned, so the deploy cannot fail on legacy data
--     and takes only a brief ACCESS EXCLUSIVE lock (metadata-only, no scan).
--
-- The trade-off is that the planner will not trust the constraint for query
-- optimisation until it is validated. That is irrelevant here; correctness
-- enforcement is the entire point.
--
-- OPERATOR FOLLOW-UP (run manually, NOT part of this migration):
--
--   -- 1. Find rows that violate the new constraints:
--   SELECT id, "productId", "warehouseId", "locationId",
--          quantity, "reservedQty", "availableQty"
--   FROM "stock_levels"
--   WHERE quantity < 0
--      OR "reservedQty" < 0
--      OR "availableQty" < 0
--   ORDER BY "productId", "warehouseId";
--
--   -- 2. Correct them (investigate root cause first — a negative balance is
--   --    usually a missing receipt or a double-issued movement, so prefer
--   --    posting a correcting inventory transaction over a blind UPDATE).
--
--   -- 3. Then promote each constraint to fully validated. VALIDATE CONSTRAINT
--   --    takes only a SHARE UPDATE EXCLUSIVE lock — it does NOT block reads or
--   --    writes — so it is safe to run online:
--   ALTER TABLE "stock_levels" VALIDATE CONSTRAINT "stock_levels_quantity_non_negative";
--   ALTER TABLE "stock_levels" VALIDATE CONSTRAINT "stock_levels_reservedQty_non_negative";
--   ALTER TABLE "stock_levels" VALIDATE CONSTRAINT "stock_levels_availableQty_non_negative";
--
--   -- 4. Confirm all three report convalidated = true:
--   SELECT conname, convalidated
--   FROM pg_constraint
--   WHERE conrelid = '"stock_levels"'::regclass AND contype = 'c';
--
-- =============================================================================


-- -----------------------------------------------------------------------------
-- PART 1: Foreign key indexes
-- -----------------------------------------------------------------------------

-- journal_entries: the backbone of invoice→GL and payment→GL traceability.
-- Every "show me the journal entries for this document" lookup was a seq scan.
CREATE INDEX IF NOT EXISTS "journal_entries_invoiceId_idx"              ON "journal_entries"("invoiceId");
CREATE INDEX IF NOT EXISTS "journal_entries_paymentId_idx"              ON "journal_entries"("paymentId");
CREATE INDEX IF NOT EXISTS "journal_entries_salesOrderId_idx"           ON "journal_entries"("salesOrderId");
CREATE INDEX IF NOT EXISTS "journal_entries_purchaseOrderId_idx"        ON "journal_entries"("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "journal_entries_inventoryTransactionId_idx" ON "journal_entries"("inventoryTransactionId");
-- reconciliationId is a bare uuid stamp (no FK) written by bank reconciliation
-- confirm/reject; indexed so "which JEs belong to reconciliation X" is cheap.
CREATE INDEX IF NOT EXISTS "journal_entries_reconciliationId_idx"       ON "journal_entries"("reconciliationId");

-- payments: only invoiceId was indexed. Customer/supplier payment history and
-- AR/AP aging both filter on these.
CREATE INDEX IF NOT EXISTS "payments_customerId_idx" ON "payments"("customerId");
CREATE INDEX IF NOT EXISTS "payments_supplierId_idx" ON "payments"("supplierId");

-- purchase_order_items: the parent FK on the hottest join in procurement.
-- Also accelerates the ON DELETE CASCADE from purchase_orders.
CREATE INDEX IF NOT EXISTS "purchase_order_items_purchaseOrderId_idx" ON "purchase_order_items"("purchaseOrderId");

-- inventory_transactions: source-document traceability (ledger → originating
-- PO / SO / WO / stock audit).
CREATE INDEX IF NOT EXISTS "inventory_transactions_purchaseOrderId_idx" ON "inventory_transactions"("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "inventory_transactions_salesOrderId_idx"    ON "inventory_transactions"("salesOrderId");
CREATE INDEX IF NOT EXISTS "inventory_transactions_workOrderId_idx"     ON "inventory_transactions"("workOrderId");
CREATE INDEX IF NOT EXISTS "inventory_transactions_adjustmentId_idx"    ON "inventory_transactions"("adjustmentId");

-- invoices: SO→invoice, PO→bill and PR→bill lookups. "orderId" is the legacy
-- polymorphic reference still queried via OR clauses in finance-invoices.ts /
-- procurement.ts; "quoteId" is declared but currently unqueried — indexed for
-- symmetry and because the column is sparse (cheap index).
CREATE INDEX IF NOT EXISTS "invoices_salesOrderId_idx"      ON "invoices"("salesOrderId");
CREATE INDEX IF NOT EXISTS "invoices_purchaseOrderId_idx"   ON "invoices"("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "invoices_purchaseRequestId_idx" ON "invoices"("purchaseRequestId");
CREATE INDEX IF NOT EXISTS "invoices_quoteId_idx"           ON "invoices"("quoteId");
CREATE INDEX IF NOT EXISTS "invoices_orderId_idx"           ON "invoices"("orderId");

-- customers: master-data FKs used by segmentation, pricing and sales-rep views.
CREATE INDEX IF NOT EXISTS "customers_categoryId_idx"    ON "customers"("categoryId");
CREATE INDEX IF NOT EXISTS "customers_priceListId_idx"   ON "customers"("priceListId");
CREATE INDEX IF NOT EXISTS "customers_salesPersonId_idx" ON "customers"("salesPersonId");

-- work_orders: "all work orders producing product X" — production planning.
CREATE INDEX IF NOT EXISTS "work_orders_productId_idx" ON "work_orders"("productId");

-- debit_credit_notes: credit/debit notes issued against a given invoice.
CREATE INDEX IF NOT EXISTS "debit_credit_notes_originalInvoiceId_idx" ON "debit_credit_notes"("originalInvoiceId");


-- -----------------------------------------------------------------------------
-- PART 2: Non-negative stock CHECK constraints (NOT VALID — see header)
-- -----------------------------------------------------------------------------
-- Column names are the Prisma field names verbatim: the StockLevel model maps
-- to table "stock_levels" via @@map, but quantity / reservedQty / availableQty
-- have no @map, so they are camelCase quoted identifiers in PostgreSQL.
-- All three are Decimal(18,4) (migration 20260423160000_stock_level_decimal).
--
-- Postgres has no ADD CONSTRAINT IF NOT EXISTS, so each is guarded by a
-- pg_constraint lookup to keep the migration re-runnable.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'stock_levels_quantity_non_negative'
          AND conrelid = '"stock_levels"'::regclass
    ) THEN
        ALTER TABLE "stock_levels"
            ADD CONSTRAINT "stock_levels_quantity_non_negative"
            CHECK ("quantity" >= 0) NOT VALID;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'stock_levels_reservedQty_non_negative'
          AND conrelid = '"stock_levels"'::regclass
    ) THEN
        ALTER TABLE "stock_levels"
            ADD CONSTRAINT "stock_levels_reservedQty_non_negative"
            CHECK ("reservedQty" >= 0) NOT VALID;
    END IF;
END
$$;

-- NOTE: availableQty is maintained as (quantity - reservedQty) by the
-- application. Enforcing availableQty >= 0 therefore also enforces "you cannot
-- reserve more than is on hand". The reservation paths already guard this
-- (lib/actions/stock-reservations.ts, lib/actions/sales.ts clamp with
-- Math.min / `availableQty: { gt: 0 }`), so this codifies existing intent
-- rather than changing it — but any unguarded decrement that slips through
-- will now fail loudly at the database instead of corrupting stock silently.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'stock_levels_availableQty_non_negative'
          AND conrelid = '"stock_levels"'::regclass
    ) THEN
        ALTER TABLE "stock_levels"
            ADD CONSTRAINT "stock_levels_availableQty_non_negative"
            CHECK ("availableQty" >= 0) NOT VALID;
    END IF;
END
$$;

-- ============================================================================
-- ERP Performance Indexes & Materialized Views
-- Generated: 2026-03-30
--
-- Run this in Supabase SQL Editor.
-- All indexes use IF NOT EXISTS — safe to re-run.
-- Column names are camelCase (Prisma default, no @map overrides).
-- ============================================================================

-- ############################################################################
-- SECTION 1: MISSING COMPOSITE INDEXES
-- ############################################################################

-- ---------------------------------------------------------------------------
-- 1. Invoice: type + status + issueDate
-- Used by: /api/finance/invoices/kanban (filters type=INV_OUT, groups by status, orders by issueDate)
-- Existing: @@index([type, status]) and @@index([issueDate]) separately
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_invoices_type_status_issue_date
    ON invoices ("type", "status", "issueDate" DESC);

-- Also useful for overdue detection: status != PAID, type, dueDate < now
CREATE INDEX IF NOT EXISTS idx_invoices_status_due_date
    ON invoices ("status", "dueDate")
    WHERE "status" NOT IN ('PAID', 'CANCELLED', 'VOID');

-- ---------------------------------------------------------------------------
-- 2. JournalEntry: date + status
-- Used by: /api/finance/dashboard-data (7-day recent entries, status=POSTED)
-- and /api/finance/transactions (date range filter + status)
-- Existing: @@index([date]) only
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_journal_entries_date_status
    ON journal_entries ("date" DESC, "status");

-- Partial index for POSTED entries (most common query filter)
CREATE INDEX IF NOT EXISTS idx_journal_entries_posted
    ON journal_entries ("date" DESC)
    WHERE "status" = 'POSTED';

-- ---------------------------------------------------------------------------
-- 3. SalesOrder: status + orderDate
-- Used by: /api/sales/orders (filter by status, order by orderDate)
-- Existing: @@index([status]) and @@index([orderDate]) separately
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sales_orders_status_order_date
    ON sales_orders ("status", "orderDate" DESC);

-- Customer + date for customer-specific order history
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer_order_date
    ON sales_orders ("customerId", "orderDate" DESC);

-- ---------------------------------------------------------------------------
-- 4. PurchaseOrder: status + createdAt
-- Used by: /api/procurement/dashboard (pending approvals, ordered by date)
-- Existing: @@index([status]) and @@index([updatedAt]) separately
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status_created
    ON purchase_orders ("status", "createdAt" DESC);

-- ---------------------------------------------------------------------------
-- 5. Attendance: date + status
-- Used by: /api/hcm/attendance-full (all attendance for a specific date)
-- Existing: @@index([employeeId, date]) — good for employee lookup, not date scan
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_attendance_date_status
    ON attendance ("date", "status");

-- ---------------------------------------------------------------------------
-- 6. WorkOrder: status + createdAt
-- Used by: /api/manufacturing/dashboard (monthly metrics by status)
-- Existing: @@index([salesOrderId]) and @@index([machineId]) only
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_work_orders_status_created
    ON work_orders ("status", "createdAt" DESC);

-- Also for active orders (IN_PROGRESS) — frequently queried
CREATE INDEX IF NOT EXISTS idx_work_orders_active
    ON work_orders ("createdAt" DESC)
    WHERE "status" = 'IN_PROGRESS';

-- ---------------------------------------------------------------------------
-- 7. QualityInspection: inspectionDate + status
-- Used by: /api/manufacturing/dashboard (monthly pass/fail rates)
-- Existing: @@index([workOrderId]) and @@index([status]) separately
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_quality_inspections_date_status
    ON quality_inspections ("inspectionDate" DESC, "status");

-- ---------------------------------------------------------------------------
-- 8. PurchaseOrderItem: purchaseOrderId + productId
-- Used by: /api/inventory/page-data (aggregate PO items by product)
-- Existing: @@index([purchaseOrderId]) only
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_product
    ON purchase_order_items ("purchaseOrderId", "productId");

-- ---------------------------------------------------------------------------
-- 9. PurchaseRequestItem: purchaseRequestId + productId
-- Used by: /api/inventory/page-data (aggregate PR items by product)
-- Existing: no index on purchaseRequestId
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_purchase_request_items_pr_product
    ON purchase_request_items ("purchaseRequestId", "productId");

-- ---------------------------------------------------------------------------
-- 10. JournalLine: entryId + accountId
-- Used by: /api/finance/transactions (join lines with entries and accounts)
-- Existing: @@index([entryId]) and @@index([accountId]) separately
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry_account
    ON journal_lines ("entryId", "accountId");

-- Account + entry for account-based transaction lookups
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_entry
    ON journal_lines ("accountId", "entryId");

-- ---------------------------------------------------------------------------
-- 11. InvoiceItem: invoiceId + productId
-- Used by: finance dashboards that aggregate line items per invoice
-- Existing: @@index([invoiceId]) and @@index([productId]) separately
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_product
    ON invoice_items ("invoiceId", "productId");

-- ---------------------------------------------------------------------------
-- 12. Payment: type + deposited (for undeposited funds query)
-- Already has @@index([type, deposited]) — GOOD
-- Add: invoiceId for payment-to-invoice lookups
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_payments_invoice_date
    ON payments ("invoiceId", "date" DESC);


-- ############################################################################
-- SECTION 2: MATERIALIZED VIEW — Dashboard Financial Summary
-- ############################################################################

-- This view pre-computes the key metrics queried by /api/dashboard.
-- Refresh with: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_financials;
-- Schedule refresh every 15 minutes via Supabase cron or pg_cron.

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_financials AS
WITH
  -- AR (Accounts Receivable) — outstanding invoices
  ar_summary AS (
    SELECT
      COUNT(*) FILTER (WHERE "status" IN ('ISSUED', 'PARTIAL', 'OVERDUE')) AS ar_open_count,
      COALESCE(SUM(CASE WHEN "status" IN ('ISSUED', 'PARTIAL', 'OVERDUE') THEN "totalAmount" ELSE 0 END), 0) AS ar_outstanding,
      COUNT(*) FILTER (WHERE "status" = 'OVERDUE') AS ar_overdue_count,
      COALESCE(SUM(CASE WHEN "status" = 'OVERDUE' THEN "totalAmount" ELSE 0 END), 0) AS ar_overdue_amount,
      COALESCE(SUM(CASE WHEN "status" = 'PAID' AND "updatedAt" >= date_trunc('month', CURRENT_DATE) THEN "totalAmount" ELSE 0 END), 0) AS ar_collected_this_month
    FROM invoices
    WHERE "type" = 'INV_OUT'
  ),
  -- AP (Accounts Payable) — outstanding bills
  ap_summary AS (
    SELECT
      COUNT(*) FILTER (WHERE "status" IN ('ISSUED', 'PARTIAL', 'OVERDUE')) AS ap_open_count,
      COALESCE(SUM(CASE WHEN "status" IN ('ISSUED', 'PARTIAL', 'OVERDUE') THEN "totalAmount" ELSE 0 END), 0) AS ap_outstanding,
      COUNT(*) FILTER (WHERE "status" = 'OVERDUE') AS ap_overdue_count,
      COALESCE(SUM(CASE WHEN "status" = 'OVERDUE' THEN "totalAmount" ELSE 0 END), 0) AS ap_overdue_amount
    FROM invoices
    WHERE "type" = 'INV_IN'
  ),
  -- Sales metrics this month
  sales_summary AS (
    SELECT
      COUNT(*) AS orders_this_month,
      COALESCE(SUM("total"), 0) AS revenue_this_month,
      COUNT(*) FILTER (WHERE "status" = 'CONFIRMED') AS confirmed_orders,
      COUNT(*) FILTER (WHERE "status" = 'IN_PROGRESS') AS in_progress_orders,
      COUNT(*) FILTER (WHERE "status" = 'DELIVERED') AS delivered_orders
    FROM sales_orders
    WHERE "orderDate" >= date_trunc('month', CURRENT_DATE)
  ),
  -- Purchase order metrics
  po_summary AS (
    SELECT
      COUNT(*) FILTER (WHERE "status" = 'PENDING_APPROVAL') AS pending_approval,
      COUNT(*) FILTER (WHERE "status" IN ('APPROVED', 'ORDERED', 'SHIPPED')) AS active_pos,
      COALESCE(SUM(CASE WHEN "status" = 'PENDING_APPROVAL' THEN "netAmount" ELSE 0 END), 0) AS pending_amount
    FROM purchase_orders
  ),
  -- Manufacturing metrics this month
  mfg_summary AS (
    SELECT
      COUNT(*) FILTER (WHERE "status" = 'IN_PROGRESS') AS active_work_orders,
      COUNT(*) FILTER (WHERE "status" = 'COMPLETED' AND "updatedAt" >= date_trunc('month', CURRENT_DATE)) AS completed_this_month,
      COUNT(*) FILTER (WHERE "status" = 'ON_HOLD') AS on_hold_orders
    FROM work_orders
  )
SELECT
  ar.*,
  ap.*,
  sales.*,
  po.*,
  mfg.*,
  CURRENT_TIMESTAMP AS refreshed_at
FROM ar_summary ar
CROSS JOIN ap_summary ap
CROSS JOIN sales_summary sales
CROSS JOIN po_summary po
CROSS JOIN mfg_summary mfg;

-- Unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dashboard_financials_unique
    ON mv_dashboard_financials (refreshed_at);


-- ############################################################################
-- SECTION 3: MATERIALIZED VIEW — Inventory Status Summary
-- ############################################################################

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_inventory_status AS
SELECT
  p.id AS product_id,
  p.name AS product_name,
  p.code,
  p."minStock",
  COALESCE(SUM(sl.quantity), 0) AS total_stock,
  COALESCE(SUM(sl."reservedQty"), 0) AS total_reserved,
  COALESCE(SUM(sl."availableQty"), 0) AS total_available,
  COUNT(DISTINCT sl."warehouseId") AS warehouse_count,
  CASE
    WHEN COALESCE(SUM(sl.quantity), 0) = 0 THEN 'OUT_OF_STOCK'
    WHEN COALESCE(SUM(sl.quantity), 0) <= COALESCE(p."minStock", 0) THEN 'LOW_STOCK'
    WHEN COALESCE(SUM(sl.quantity), 0) <= COALESCE(p."minStock", 0) * 1.5 THEN 'WARNING'
    ELSE 'HEALTHY'
  END AS stock_status,
  CURRENT_TIMESTAMP AS refreshed_at
FROM products p
LEFT JOIN stock_levels sl ON sl."productId" = p.id
WHERE p."isActive" = true
GROUP BY p.id, p.name, p.code, p."minStock";

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_inventory_status_product
    ON mv_inventory_status (product_id);

CREATE INDEX IF NOT EXISTS idx_mv_inventory_status_status
    ON mv_inventory_status (stock_status);


-- ############################################################################
-- SECTION 4: REFRESH SCHEDULE (pg_cron — run once to set up)
-- ############################################################################

-- Enable pg_cron extension if not already enabled
-- (In Supabase, go to Database > Extensions > Enable pg_cron)

-- Refresh dashboard financials every 15 minutes
-- SELECT cron.schedule('refresh-dashboard-financials', '*/15 * * * *',
--     'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_financials');

-- Refresh inventory status every 30 minutes
-- SELECT cron.schedule('refresh-inventory-status', '*/30 * * * *',
--     'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_inventory_status');


-- ############################################################################
-- SECTION 5: VERIFICATION QUERIES (run with EXPLAIN ANALYZE to check)
-- ############################################################################

-- 1. Invoice kanban query (should use idx_invoices_type_status_issue_date)
EXPLAIN ANALYZE
SELECT id, "number", "type", "status", "totalAmount", "issueDate", "dueDate"
FROM invoices
WHERE "type" = 'INV_OUT' AND "status" IN ('DRAFT', 'ISSUED', 'OVERDUE', 'PAID')
ORDER BY "issueDate" DESC
LIMIT 100;

-- 2. Journal entries list (should use idx_journal_entries_date_status)
EXPLAIN ANALYZE
SELECT je.id, je.description, je."date", je."status", je.reference
FROM journal_entries je
WHERE je."status" = 'POSTED' AND je."date" >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY je."date" DESC
LIMIT 50;

-- 3. Sales orders list (should use idx_sales_orders_status_order_date)
EXPLAIN ANALYZE
SELECT id, "number", "status", "total", "orderDate", "customerId"
FROM sales_orders
WHERE "status" IN ('CONFIRMED', 'IN_PROGRESS')
ORDER BY "orderDate" DESC
LIMIT 50;

-- 4. Attendance daily view (should use idx_attendance_date_status)
EXPLAIN ANALYZE
SELECT a.id, a."employeeId", a."status", a."checkIn", a."checkOut"
FROM attendance a
WHERE a."date" = CURRENT_DATE
ORDER BY a."checkIn" ASC;

-- 5. Dashboard financials from materialized view (should be instant)
EXPLAIN ANALYZE
SELECT * FROM mv_dashboard_financials;

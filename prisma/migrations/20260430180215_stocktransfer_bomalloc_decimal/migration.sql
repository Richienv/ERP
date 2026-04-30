-- Note: applied via raw SQL + `prisma migrate resolve --applied` because the
-- preceding `20260430170000_mining_fleet_additive` migration is in P3009
-- failed-state in `_prisma_migrations` (blocked on materialized view
-- mv_dashboard_financials depending on invoices.totalAmount). The two
-- ALTER COLUMNs below are independent of that, so they were executed
-- directly. Same workaround spirit as Tasks 18 + 28 (see prior migrations).

-- Round-5 audit H2: complete the Decimal(18,4) alignment for the two
-- quantity columns missed in Tasks 18 + 28. ALTER TYPE preserves existing
-- Int values (all are valid Decimals); no data backfill needed.

-- StockTransfer
ALTER TABLE "stock_transfers"
    ALTER COLUMN "quantity" TYPE DECIMAL(18, 4) USING "quantity"::DECIMAL(18, 4);

-- ProductionBOMAllocation (table mapping per @@map)
ALTER TABLE "production_bom_allocations"
    ALTER COLUMN "quantity" TYPE DECIMAL(18, 4) USING "quantity"::DECIMAL(18, 4);

-- H10 (inventory): StockLevel quantities Int → Decimal(18,4).
--
-- Why: fabric rolls store lengthMeters as Decimal(10,2) but StockLevel
-- can only hold integers — cutting 2.5m of fabric loses the 0.5m.
-- Same for kg/liter products.
--
-- Decimal(18,4) chosen for:
--   - 18 total digits (enough for 10^14 units)
--   - 4 fractional places (handles fabric .25m, .375m precision)
--   - Matches FabricRoll.lengthMeters precision class
--
-- Existing Int values cast losslessly to Decimal.
--
-- NOTE: materialized view `mv_inventory_status` (created via Supabase
-- dashboard, outside Prisma migrations) depends on these columns — we
-- must DROP it before ALTER, then recreate. Safe because the view is
-- a read-only derived aggregate rebuilt from stock_levels.

DROP MATERIALIZED VIEW IF EXISTS "mv_inventory_status" CASCADE;

ALTER TABLE "stock_levels"
    ALTER COLUMN "quantity"     TYPE DECIMAL(18,4) USING "quantity"::DECIMAL(18,4),
    ALTER COLUMN "reservedQty"  TYPE DECIMAL(18,4) USING "reservedQty"::DECIMAL(18,4),
    ALTER COLUMN "availableQty" TYPE DECIMAL(18,4) USING "availableQty"::DECIMAL(18,4);

-- StockAuditItem must match StockLevel precision for cycle counts to
-- record fractional fabric meters / kg / liter without loss.
ALTER TABLE "stock_audit_items"
    ALTER COLUMN "expectedQty" TYPE DECIMAL(18,4) USING "expectedQty"::DECIMAL(18,4),
    ALTER COLUMN "actualQty"   TYPE DECIMAL(18,4) USING "actualQty"::DECIMAL(18,4);

-- Recreate the materialized view with Decimal-aware aggregates.
CREATE MATERIALIZED VIEW "mv_inventory_status" AS
SELECT p.id AS product_id,
    p.name AS product_name,
    p.code,
    p."minStock",
    COALESCE(sum(sl.quantity), 0::numeric) AS total_stock,
    COALESCE(sum(sl."reservedQty"), 0::numeric) AS total_reserved,
    COALESCE(sum(sl."availableQty"), 0::numeric) AS total_available,
    count(DISTINCT sl."warehouseId") AS warehouse_count,
    CASE
        WHEN COALESCE(sum(sl.quantity), 0::numeric) = 0 THEN 'OUT_OF_STOCK'::text
        WHEN COALESCE(sum(sl.quantity), 0::numeric) <= COALESCE(p."minStock", 0)::numeric THEN 'LOW_STOCK'::text
        WHEN COALESCE(sum(sl.quantity), 0::numeric) <= (COALESCE(p."minStock", 0)::numeric * 1.5) THEN 'WARNING'::text
        ELSE 'HEALTHY'::text
    END AS stock_status,
    CURRENT_TIMESTAMP AS refreshed_at
FROM products p
    LEFT JOIN stock_levels sl ON sl."productId" = p.id
WHERE p."isActive" = true
GROUP BY p.id, p.name, p.code, p."minStock";

CREATE UNIQUE INDEX "idx_mv_inventory_status_product" ON "mv_inventory_status" USING btree (product_id);
CREATE INDEX "idx_mv_inventory_status_status" ON "mv_inventory_status" USING btree (stock_status);

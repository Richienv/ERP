-- H3 (inventory): PostgreSQL UNIQUE treats NULLs as distinct, so the existing
-- @@unique([productId, warehouseId, locationId]) does NOT prevent two rows
-- with locationId = NULL for the same (productId, warehouseId). This causes
-- findFirst+create races to silently produce duplicate rows that break
-- aggregation across the inventory module.
--
-- Fix: add a partial unique index that explicitly covers the NULL case.
-- Combined with upsert at the application layer, this eliminates the race.
--
-- Note: any existing duplicate rows must be merged before this migration
-- runs. The DELETE below removes orphaned rows that have quantity 0 (safe
-- to drop). Manual review required if your DB has duplicates with non-zero
-- quantities — consolidate first, then run this migration.

DELETE FROM "stock_levels" sl1
USING "stock_levels" sl2
WHERE sl1.id <> sl2.id
  AND sl1."productId" = sl2."productId"
  AND sl1."warehouseId" = sl2."warehouseId"
  AND sl1."locationId" IS NULL
  AND sl2."locationId" IS NULL
  AND sl1.quantity = 0
  AND sl1."reservedQty" = 0;

CREATE UNIQUE INDEX "stock_levels_warehouse_no_location_unique"
  ON "stock_levels"("productId", "warehouseId")
  WHERE "locationId" IS NULL;

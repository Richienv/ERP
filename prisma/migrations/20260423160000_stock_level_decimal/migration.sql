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

ALTER TABLE "stock_levels"
    ALTER COLUMN "quantity"     TYPE DECIMAL(18,4) USING "quantity"::DECIMAL(18,4),
    ALTER COLUMN "reservedQty"  TYPE DECIMAL(18,4) USING "reservedQty"::DECIMAL(18,4),
    ALTER COLUMN "availableQty" TYPE DECIMAL(18,4) USING "availableQty"::DECIMAL(18,4);

-- StockAuditItem must match StockLevel precision for cycle counts to
-- record fractional fabric meters / kg / liter without loss.
ALTER TABLE "stock_audit_items"
    ALTER COLUMN "expectedQty" TYPE DECIMAL(18,4) USING "expectedQty"::DECIMAL(18,4),
    ALTER COLUMN "actualQty"   TYPE DECIMAL(18,4) USING "actualQty"::DECIMAL(18,4);

-- Note: applied via `prisma migrate deploy` rather than `migrate dev` due to
-- the pre-existing P3006 on add_po_events shadow-DB replay (see prior migrations).

-- Align PO/GRN/PR item quantities with InventoryTransaction.quantity (also
-- Decimal(18,4) since 2d243de). Existing Int values are valid Decimals;
-- ALTER TYPE preserves them with no data loss.

-- PurchaseOrderItem
ALTER TABLE "purchase_order_items"
    ALTER COLUMN "quantity" TYPE DECIMAL(18, 4) USING "quantity"::DECIMAL(18, 4),
    ALTER COLUMN "receivedQty" TYPE DECIMAL(18, 4) USING "receivedQty"::DECIMAL(18, 4),
    ALTER COLUMN "returnedQty" TYPE DECIMAL(18, 4) USING "returnedQty"::DECIMAL(18, 4);

-- GRNItem
ALTER TABLE "grn_items"
    ALTER COLUMN "quantityOrdered" TYPE DECIMAL(18, 4) USING "quantityOrdered"::DECIMAL(18, 4),
    ALTER COLUMN "quantityReceived" TYPE DECIMAL(18, 4) USING "quantityReceived"::DECIMAL(18, 4),
    ALTER COLUMN "quantityAccepted" TYPE DECIMAL(18, 4) USING "quantityAccepted"::DECIMAL(18, 4),
    ALTER COLUMN "quantityRejected" TYPE DECIMAL(18, 4) USING "quantityRejected"::DECIMAL(18, 4);

-- PurchaseRequestItem
ALTER TABLE "purchase_request_items"
    ALTER COLUMN "quantity" TYPE DECIMAL(18, 4) USING "quantity"::DECIMAL(18, 4);

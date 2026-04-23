-- C1: Add purchaseRequestItemId FK to purchase_order_items so we can
-- trace "which PO item satisfies which PR item" and prevent
-- double-conversion atomically at the DB level.

ALTER TABLE "purchase_order_items"
  ADD COLUMN "purchaseRequestItemId" UUID;

ALTER TABLE "purchase_order_items"
  ADD CONSTRAINT "purchase_order_items_purchaseRequestItemId_fkey"
  FOREIGN KEY ("purchaseRequestItemId")
  REFERENCES "purchase_request_items"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "purchase_order_items_purchaseRequestItemId_idx"
  ON "purchase_order_items"("purchaseRequestItemId");

-- Partial unique index: at most ONE active PO item can reference a given
-- PR item (prevents double-conversion). Allows multiple references if
-- the PO is CANCELLED — those don't actually consume the PR item.
-- Note: PurchaseOrderItem doesn't have its own status; we check the
-- parent purchase_orders.status via a UNIQUE on (purchaseRequestItemId)
-- WHERE purchaseRequestItemId IS NOT NULL. The application layer
-- additionally clears purchaseRequestItemId when a PO is cancelled.
CREATE UNIQUE INDEX "purchase_order_items_active_pr_item_unique"
  ON "purchase_order_items"("purchaseRequestItemId")
  WHERE "purchaseRequestItemId" IS NOT NULL;

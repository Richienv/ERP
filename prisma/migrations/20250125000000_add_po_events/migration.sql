-- CreateTable
CREATE TABLE IF NOT EXISTS "purchase_order_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "purchaseOrderId" UUID NOT NULL,
    "status" "ProcurementStatus" NOT NULL,
    "changedBy" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_order_events_purchaseOrderId_idx" ON "purchase_order_events"("purchaseOrderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_order_events_createdAt_idx" ON "purchase_order_events"("createdAt");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'purchase_order_events_purchaseOrderId_fkey'
    ) THEN
        ALTER TABLE "purchase_order_events" ADD CONSTRAINT "purchase_order_events_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

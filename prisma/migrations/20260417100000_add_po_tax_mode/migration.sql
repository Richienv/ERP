-- Add TaxMode enum and taxMode column to PurchaseOrder
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaxMode') THEN
        CREATE TYPE "TaxMode" AS ENUM ('EXCLUSIVE', 'INCLUSIVE', 'NON_PPN');
    END IF;
END$$;

ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "taxMode" "TaxMode" NOT NULL DEFAULT 'EXCLUSIVE';

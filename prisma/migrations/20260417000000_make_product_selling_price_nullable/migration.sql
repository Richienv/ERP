-- Make Product.sellingPrice nullable so products without a defined selling price
-- can be created (e.g. raw materials, WIP, or new SKUs awaiting pricing decision).
-- Existing products with sellingPrice = 0 stay as-is; they remain "priced" at zero.
-- Legacy rows are not modified — only the column constraint is relaxed.

-- Prisma map: @@map("products") — actual table is lowercase "products".
-- Use IF EXISTS guard so migration is safe to re-run and self-heals against
-- either naming (legacy "Product" from very old deploy vs current "products").
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        ALTER TABLE "products" ALTER COLUMN "sellingPrice" DROP NOT NULL;
        ALTER TABLE "products" ALTER COLUMN "sellingPrice" DROP DEFAULT;
    END IF;
END$$;

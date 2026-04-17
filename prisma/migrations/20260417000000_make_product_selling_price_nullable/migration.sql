-- Make Product.sellingPrice nullable so products without a defined selling price
-- can be created (e.g. raw materials, WIP, or new SKUs awaiting pricing decision).
-- Existing products with sellingPrice = 0 stay as-is; they remain "priced" at zero.
-- Legacy rows are not modified — only the column constraint is relaxed.

ALTER TABLE "Product" ALTER COLUMN "sellingPrice" DROP NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "sellingPrice" DROP DEFAULT;

-- Performance indexes for inventory list endpoints.
-- Both Product and Warehouse list queries filter on isActive (no index → seq scan)
-- and order by createdAt / name. Composite indexes cover the common access pattern.

-- Products: active items, ordered by createdAt DESC (matches db564be orderBy).
CREATE INDEX IF NOT EXISTS "products_isActive_idx" ON "products"("isActive");
CREATE INDEX IF NOT EXISTS "products_isActive_createdAt_idx" ON "products"("isActive", "createdAt");

-- Warehouses: active warehouses, ordered by name ASC (matches page-data orderBy).
CREATE INDEX IF NOT EXISTS "warehouses_isActive_idx" ON "warehouses"("isActive");
CREATE INDEX IF NOT EXISTS "warehouses_isActive_name_idx" ON "warehouses"("isActive", "name");

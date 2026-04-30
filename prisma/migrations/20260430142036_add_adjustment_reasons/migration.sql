-- Note: applied via `prisma migrate deploy` (not migrate dev) due to a known
-- pre-existing P3006 on older migration replay against the shadow DB. See
-- 20260430052555_inventory_perf_indexes for the same workaround pattern.

-- AdjustmentReason master table for Smart Select on the adjustment form.
-- Uses uuid_generate_v4() to match existing master tables (Unit, Brand, Color).
CREATE TABLE IF NOT EXISTS "adjustment_reasons" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adjustment_reasons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "adjustment_reasons_code_key" ON "adjustment_reasons"("code");
CREATE INDEX IF NOT EXISTS "adjustment_reasons_isActive_idx" ON "adjustment_reasons"("isActive");

-- Seed 8 common Indonesian factory reasons. Idempotent via ON CONFLICT.
INSERT INTO "adjustment_reasons" ("code", "name", "updatedAt") VALUES
  ('SELISIH_AUDIT',    'Selisih Audit / Stok Opname', NOW()),
  ('BARANG_RUSAK',     'Barang Rusak / Cacat',         NOW()),
  ('BARANG_KADALUARSA','Barang Kadaluarsa',            NOW()),
  ('KENA_TIKUS',       'Kena Tikus / Hama',            NOW()),
  ('KEBANJIRAN',       'Kebanjiran / Kerusakan Air',   NOW()),
  ('SALAH_SCAN',       'Salah Scan / Input',           NOW()),
  ('RETUR_PELANGGAN',  'Retur dari Pelanggan',         NOW()),
  ('LAINNYA',          'Lainnya',                      NOW())
ON CONFLICT ("code") DO NOTHING;

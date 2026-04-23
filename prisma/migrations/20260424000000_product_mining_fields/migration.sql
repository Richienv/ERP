-- Mining edition: add fields for spare-part traceability + equipment compatibility.
--   serialNumber          → trackable individual unit (engine SN, BPKB, etc)
--   equipmentCompatibility → free-text tags "Komatsu PC200, CAT 320D"
--   equipmentType          → category filter (heavy/light/spare/consumable/tool)

ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "serialNumber" TEXT,
    ADD COLUMN IF NOT EXISTS "equipmentCompatibility" TEXT,
    ADD COLUMN IF NOT EXISTS "equipmentType" TEXT;

-- GIN index on compatibility tags for fast "find all parts for PC200" search.
CREATE INDEX IF NOT EXISTS "products_equipmentCompatibility_idx"
    ON "products" USING gin (to_tsvector('simple', COALESCE("equipmentCompatibility", '')));

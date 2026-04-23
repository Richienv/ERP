-- Mining edition: Vehicle/Armada master untuk rental fleet + service center
-- + customer-owned vehicles (untuk service order eksternal).
--
-- Optional 1:1 ke FixedAsset (kalau registered untuk depresiasi).
-- Optional ke Customer (kalau owned by customer eksternal).

CREATE TYPE "VehicleType" AS ENUM (
    'LIGHT_VEHICLE',
    'HEAVY_EQUIPMENT',
    'TRUCK',
    'TRAILER',
    'MOTORCYCLE',
    'OTHER'
);

CREATE TYPE "VehicleStatus" AS ENUM (
    'AVAILABLE',
    'RENTED',
    'IN_SERVICE',
    'RESERVED',
    'SOLD',
    'WRITTEN_OFF',
    'INACTIVE'
);

CREATE TABLE "vehicles" (
    "id"              UUID NOT NULL DEFAULT uuid_generate_v4(),

    -- Identification
    "plateNumber"     TEXT NOT NULL,
    "vin"             TEXT,
    "engineNumber"    TEXT,

    -- Make / model
    "brand"           TEXT NOT NULL,
    "model"           TEXT NOT NULL,
    "variant"         TEXT,
    "year"            INTEGER NOT NULL,
    "color"           TEXT,

    -- Documents
    "bpkbNumber"             TEXT,
    "stnkNumber"             TEXT,
    "stnkExpiry"             DATE,
    "kirNumber"              TEXT,
    "kirExpiry"              DATE,
    "insurancePolicyNumber"  TEXT,
    "insuranceExpiry"        DATE,
    "insurer"                TEXT,

    -- Operational
    "vehicleType"     "VehicleType"   NOT NULL DEFAULT 'LIGHT_VEHICLE',
    "status"          "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "warehouseId"     UUID,
    "currentLocation" TEXT,

    -- Operational metrics
    "odometer"     INTEGER,
    "engineHours"  DECIMAL(10, 1),

    -- Rental rates
    "dailyRate"   DECIMAL(20, 2),
    "monthlyRate" DECIMAL(20, 2),

    -- Linked records
    "fixedAssetId"     UUID,
    "ownerCustomerId"  UUID,

    -- Notes
    "notes"    TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- Unique plateNumber
CREATE UNIQUE INDEX "vehicles_plateNumber_key" ON "vehicles"("plateNumber");

-- 1:1 with FixedAsset
CREATE UNIQUE INDEX "vehicles_fixedAssetId_key" ON "vehicles"("fixedAssetId") WHERE "fixedAssetId" IS NOT NULL;

-- Performance indexes
CREATE INDEX "vehicles_status_idx"          ON "vehicles"("status");
CREATE INDEX "vehicles_vehicleType_idx"     ON "vehicles"("vehicleType");
CREATE INDEX "vehicles_ownerCustomerId_idx" ON "vehicles"("ownerCustomerId");
CREATE INDEX "vehicles_warehouseId_idx"     ON "vehicles"("warehouseId");

-- Foreign keys
ALTER TABLE "vehicles"
    ADD CONSTRAINT "vehicles_warehouseId_fkey"
    FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vehicles"
    ADD CONSTRAINT "vehicles_fixedAssetId_fkey"
    FOREIGN KEY ("fixedAssetId") REFERENCES "fixed_assets"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vehicles"
    ADD CONSTRAINT "vehicles_ownerCustomerId_fkey"
    FOREIGN KEY ("ownerCustomerId") REFERENCES "customers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

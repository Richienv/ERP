-- H6/M7 (inventory): FabricRoll traceability + inspection gate.
--   • grnItemId FK back to source GRN item — trace defective batch to vendor
--   • inspectionStatus enum gate so cutting plans cannot consume failed rolls

CREATE TYPE "FabricRollInspectionStatus" AS ENUM (
    'NOT_INSPECTED',
    'PASSED',
    'FAILED',
    'CONDITIONAL'
);

ALTER TABLE "fabric_rolls"
    ADD COLUMN "grnItemId" UUID,
    ADD COLUMN "inspectionStatus" "FabricRollInspectionStatus" NOT NULL DEFAULT 'NOT_INSPECTED';

ALTER TABLE "fabric_rolls"
    ADD CONSTRAINT "fabric_rolls_grnItemId_fkey"
    FOREIGN KEY ("grnItemId")
    REFERENCES "grn_items"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;

CREATE INDEX "fabric_rolls_grnItemId_idx" ON "fabric_rolls"("grnItemId");

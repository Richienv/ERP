-- Document System: snapshot-on-event PDF foundation.
--
-- Adds:
--   * DocType enum  -- catalog of all document kinds the system can snapshot.
--   * document_snapshots         -- immutable PDF artifacts pinned to a business entity + version.
--   * document_distributions     -- audit trail of who printed / downloaded / emailed each snapshot.

-- -----------------------------------------------------------------------------
-- Enum
-- -----------------------------------------------------------------------------
CREATE TYPE "DocType" AS ENUM (
    'PO',
    'PR',
    'GRN',
    'VENDOR_PROFILE',
    'INVOICE_AR',
    'INVOICE_AP',
    'FAKTUR_PAJAK',
    'PAYSLIP',
    'BOM',
    'SPK'
);

-- -----------------------------------------------------------------------------
-- document_snapshots
-- -----------------------------------------------------------------------------
CREATE TABLE "document_snapshots" (
    "id"           UUID         NOT NULL DEFAULT uuid_generate_v4(),
    "type"         "DocType"    NOT NULL,
    "entityId"     UUID         NOT NULL,
    "version"      INTEGER      NOT NULL,
    "storageKey"   TEXT         NOT NULL,
    "generatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy"  UUID,
    "triggerEvent" TEXT         NOT NULL,
    "label"        TEXT,
    "tags"         TEXT[],
    "archivedAt"   TIMESTAMP(3),
    "metadata"     JSONB,

    CONSTRAINT "document_snapshots_pkey" PRIMARY KEY ("id")
);

-- One immutable version per (type, entityId, version)
CREATE UNIQUE INDEX "document_snapshots_type_entityId_version_key"
    ON "document_snapshots"("type", "entityId", "version");

-- Lookup: list versions for a document
CREATE INDEX "document_snapshots_type_entityId_idx"
    ON "document_snapshots"("type", "entityId");

-- Lookup: recently generated documents
CREATE INDEX "document_snapshots_generatedAt_idx"
    ON "document_snapshots"("generatedAt");

-- -----------------------------------------------------------------------------
-- document_distributions
-- -----------------------------------------------------------------------------
CREATE TABLE "document_distributions" (
    "id"             UUID         NOT NULL DEFAULT uuid_generate_v4(),
    "snapshotId"     UUID         NOT NULL,
    "action"         TEXT         NOT NULL,
    "actorId"        UUID         NOT NULL,
    "recipientEmail" TEXT,
    "timestamp"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes"          TEXT,

    CONSTRAINT "document_distributions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_distributions_snapshotId_idx"
    ON "document_distributions"("snapshotId");

CREATE INDEX "document_distributions_timestamp_idx"
    ON "document_distributions"("timestamp");

-- Cascade delete distributions if the snapshot is removed
ALTER TABLE "document_distributions"
    ADD CONSTRAINT "document_distributions_snapshotId_fkey"
    FOREIGN KEY ("snapshotId") REFERENCES "document_snapshots"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Schema drift fix: CeoFlag model exists in schema.prisma but no migration
-- ever created the table. Dashboard /api/dashboard/ceo-flags fails with P2021.

CREATE TYPE "FlagStatus" AS ENUM ('PENDING', 'READ', 'ACTED', 'DISMISSED');

CREATE TABLE "ceo_flags" (
    "id"          UUID NOT NULL DEFAULT uuid_generate_v4(),
    "title"       TEXT NOT NULL,
    "note"        TEXT,
    "targetDept"  TEXT NOT NULL,
    "sourceType"  TEXT NOT NULL,
    "sourceId"    TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "status"      "FlagStatus" NOT NULL DEFAULT 'PENDING',
    "createdBy"   UUID NOT NULL,
    "readBy"      UUID,
    "readAt"      TIMESTAMP(3),
    "actedAt"     TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ceo_flags_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ceo_flags_targetDept_status_idx" ON "ceo_flags"("targetDept", "status");
CREATE INDEX "ceo_flags_sourceType_sourceId_idx" ON "ceo_flags"("sourceType", "sourceId");
CREATE INDEX "ceo_flags_createdAt_idx" ON "ceo_flags"("createdAt");

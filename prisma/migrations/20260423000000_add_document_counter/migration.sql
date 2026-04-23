-- Per-prefix counter to atomically generate sequential document numbers
-- without count()+1 race conditions (GRN, Stock Transfer, etc.)

CREATE TABLE IF NOT EXISTS "document_counters" (
  "id"        UUID NOT NULL DEFAULT uuid_generate_v4(),
  "prefix"    TEXT NOT NULL,
  "value"     INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "document_counters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_counters_prefix_key" ON "document_counters"("prefix");

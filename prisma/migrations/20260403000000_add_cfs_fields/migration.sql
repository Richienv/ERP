-- Migration: add_cfs_fields
-- Adds Cash Flow Statement (CFS) classification fields to gl_accounts and journal_lines

-- AlterTable: gl_accounts — CFS classification
ALTER TABLE "gl_accounts"
  ADD COLUMN IF NOT EXISTS "cfsActivity"         TEXT,
  ADD COLUMN IF NOT EXISTS "cfsLineItem"          TEXT,
  ADD COLUMN IF NOT EXISTS "cfsDirection"         TEXT,
  ADD COLUMN IF NOT EXISTS "cfsRequiresOverride"  BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: journal_lines — per-line CFS override
ALTER TABLE "journal_lines"
  ADD COLUMN IF NOT EXISTS "cfsActivityOverride"  TEXT,
  ADD COLUMN IF NOT EXISTS "cfsLineItemOverride"  TEXT,
  ADD COLUMN IF NOT EXISTS "cfsRequiresOverride"  BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "gl_accounts_cfsActivity_idx"           ON "gl_accounts"("cfsActivity");
CREATE INDEX IF NOT EXISTS "journal_lines_cfsRequiresOverride_idx" ON "journal_lines"("cfsRequiresOverride");

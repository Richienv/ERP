-- Add GL posting status to payments table
-- Tracks whether the journal entry for this payment was successfully posted.
-- Default "POSTED" for all existing records (they already have GL entries).
ALTER TABLE "payments" ADD COLUMN "glPostingStatus" TEXT NOT NULL DEFAULT 'POSTED';

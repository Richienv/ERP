-- Add index for receivedDate (used by orderBy in getAllGRNs).
CREATE INDEX IF NOT EXISTS "goods_received_notes_receivedDate_idx" ON "goods_received_notes"("receivedDate");

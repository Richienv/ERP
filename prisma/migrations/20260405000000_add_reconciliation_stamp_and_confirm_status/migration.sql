-- AlterEnum: add CONFIRMED and IGNORED to MatchStatus
ALTER TYPE "MatchStatus" ADD VALUE 'CONFIRMED';
ALTER TYPE "MatchStatus" ADD VALUE 'IGNORED';

-- AlterTable: add reconciliation stamp fields to journal_entries
ALTER TABLE "journal_entries" ADD COLUMN "isReconciled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "journal_entries" ADD COLUMN "reconciledAt" TIMESTAMP(3);
ALTER TABLE "journal_entries" ADD COLUMN "reconciledBy" UUID;
ALTER TABLE "journal_entries" ADD COLUMN "reconciliationId" UUID;
ALTER TABLE "journal_entries" ADD COLUMN "bankItemRef" TEXT;

-- CreateIndex
CREATE INDEX "journal_entries_isReconciled_idx" ON "journal_entries"("isReconciled");

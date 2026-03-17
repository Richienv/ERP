-- AlterTable
ALTER TABLE "journal_entries" ADD COLUMN "is_reversed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "journal_entries" ADD COLUMN "reversed_by_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reversed_by_id_key" ON "journal_entries"("reversed_by_id");

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversed_by_id_fkey" FOREIGN KEY ("reversed_by_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

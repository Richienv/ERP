-- Change DocumentDistribution.snapshotId FK from CASCADE to RESTRICT.
-- Audit log distributions must outlive snapshots; admins can no longer
-- delete a snapshot that has distributions.

ALTER TABLE "document_distributions" DROP CONSTRAINT "document_distributions_snapshotId_fkey";

ALTER TABLE "document_distributions" ADD CONSTRAINT "document_distributions_snapshotId_fkey"
    FOREIGN KEY ("snapshotId") REFERENCES "document_snapshots"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

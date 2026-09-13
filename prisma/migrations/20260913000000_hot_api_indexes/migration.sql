-- Hot-path indexes for mining pulse, Kas/AR/AP lists, and inbox leave counts.
-- Names follow Prisma's "<table>_<columns>_idx" convention.

CREATE INDEX "invoices_type_status_dueDate_idx" ON "invoices"("type", "status", "dueDate");
CREATE INDEX "journal_entries_status_date_idx" ON "journal_entries"("status", "date");
CREATE INDEX "leave_requests_employeeId_idx" ON "leave_requests"("employeeId");
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");

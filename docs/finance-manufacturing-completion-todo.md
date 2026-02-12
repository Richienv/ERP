# Finance + Manufacturing Completion Checklist

## Scope
This checklist covers all critical gaps for `Keuangan` and `Manufacturing` so pages are fully data-driven and module dependencies are enforced.

## Finance
- [x] Replace static finance dashboard cards/supporting widgets with live database-driven data.
- [x] Replace static cash flow chart series with calculated 7-day incoming/outgoing flow.
- [x] Replace static accounting action items with real pending counts and valid routes.
- [x] Replace static "Transaksi Terakhir" list with live mixed finance activity feed.
- [x] Implement real journal creation flow on `/finance/journal/new` (no mock submit).
- [x] Keep AP signature/check authorization flow functional and enforced.
- [x] Keep report export support for both CSV and XLS.
- [ ] Add delivery channel integration for invoice send (actual WhatsApp/email audit webhook, not log-only).
- [ ] Add dedicated reconciliation and tax pages (or route links to existing equivalent pages).

## Manufacturing
- [x] Keep work order state machine transitions enforced server-side.
- [x] Keep production posting integrated to inventory movement + finance journal posting.
- [x] Fix work order summary aggregation to use full filtered dataset (not paginated subset).
- [x] Replace planning material-readiness placeholder logic with BOM + stock-based calculation.
- [x] Replace QC pending summary placeholder with actual pending inspection workload count.
- [x] Keep machine/group/routing/BOM/SPK/QC create flows API-backed.
- [ ] Add API authz guard for all manufacturing API routes (role-based per endpoint).
- [ ] Add detailed audit trail/events for all manufacturing writes (machine, group, BOM, routing updates).
- [ ] Add integration tests for work-order posting (inventory + GL double-entry assertions).

## Cross-module dependency hardening
- [x] Finance dashboard now consumes live AP/AR/PO/journal states.
- [x] Manufacturing production posting continues to enforce inventory sufficiency before completion.
- [ ] Add unified dependency-monitor widget across procurement/inventory/manufacturing/finance.

## Validation checklist
- [ ] Manual UAT for finance dashboard cards/feeds/actions on seeded and production-like data.
- [ ] Manual UAT for journal-new posting edge cases (imbalanced lines, invalid account selections).
- [ ] Manual UAT for planning readiness under low-stock/zero-stock/partial-stock scenarios.
- [ ] Add and run endpoint-level tests for manufacturing summary/quality/planning APIs.

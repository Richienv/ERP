# Next Focus After Invoice Sprint

Updated: 2026-02-12

## Priority Queue

1. Inventory command center sync:
   - Keep Kanban and detailed list fully synchronized on every mutation.
   - Fix movement counters (inbound mismatch) and unit normalization (Roll vs Yard).
2. Inventory module interaction bugs:
   - Product card click should open stock movement history.
   - Fix low-stock section scroll cut-off.
   - Complete category tree node detail behavior.
3. Manufacturing quality flow:
   - Ensure QC dashboard counts match inspection table rows.
4. Procurement workflow stability:
   - Re-test PR -> PO conversion and status transitions end-to-end with real data.
5. Regression pass:
   - Run full procurement + finance + sales smoke flow with seeded Supabase data.

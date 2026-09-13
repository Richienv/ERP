---
name: KRI mining edition — inventory scope
description: This deployment is a mining/heavy-equipment edition; spare-parts restock loop is the priority and textile/fabric-roll features are hidden from the UI.
type: project
---

The inventory module is being shipped as a mining/heavy-equipment ("KRI") edition:
spare parts and consumables, GRN receiving, low-stock alerts, and "Buat PR" from the
alerts page (`/inventory/alerts?buat=<productId>`, linked from the mining command
inbox). Fabric rolls, cutting, and other textile features still exist in code but are
HIDDEN in this edition.

**Why:** The customer is a mining contractor, not a garment factory. The daily loop
that has to feel fast and correct is: low-stock inbox → alerts page → Buat PR → PO →
GRN receive → stock + GL 1300.

**How to apply:** When prioritising inventory bugs or perf work, weight anything on the
restock/receiving path highest. Treat textile-only code paths (fabric rolls, BOM/
workOrder fan-out inside product queries such as `getMaterialGapAnalysis`) as dead
weight for this customer — safe to trim/skip, not to invest in.

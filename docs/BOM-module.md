Based on your meeting discussion and the My-ERP architecture doc, here is a detailed visualization of how the BOM (Bill of Materials) module should work and look:

---

### Page Structure Overview

The BOM page is split into **3 main zones** stacked vertically:

**Zone 1 — Header Bar (Product Info)**

- Product name, product code, BOM version number
- Total quantity to produce (e.g., "1,000 pcs")
- Status badge (Draft / Active / Archived)
- Action buttons: Save, Generate SPK, Export PDF, Upload Pattern

**Zone 2 — Item List + Work Center Builder (Split Panel)**

- **Left panel (30% width):** Scrollable list of all items/materials in this BOM (buttons, zippers, fabric, thread, etc.) with quantity per unit
- **Right panel (70% width):** Drag-and-drop work center flow canvas

**Zone 3 — Detail Drawer (Bottom)**

- Appears when you click any work center node
- Shows: in-house vs. subcontractor, cost breakdown, vendor info, allocated quantity, process specs

---

### Zone 2 Detail: The Drag-and-Drop Flow Builder

This is the core of the BOM page. Here is how it works:

**Left Panel — Item Bank**

| Item Code | Item Name | Qty/Unit | Category | ITM-001 | Cotton Fabric 30s | 1.5 m | Raw Material |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ITM-002 | YKK Zipper 20cm | 1 pc | Accessory | ITM-003 | Button 12mm | 6 pcs | Accessory |
| ITM-004 | Thread Polyester | 15 m | Raw Material | ITM-005 | Label Tag | 1 pc | Packaging |
- Items are **persistent** -- dragging an item to a work center does **not** remove it from the list (it can be used in multiple processes)[[1]](https://www.notion.so/Items-can-be-used-in-multiple-processes-without-disappearing-from-the-list-311e6626e75481a284cff44cc5ab6390?pvs=21)
- Each item shows a small badge of how many work centers it is assigned to

**Right Panel — Work Center Flow Canvas**

The work centers are displayed as **horizontal cards in a left-to-right sequential flow**, connected by arrows to show production routing:

```
[ CUTTING ] ──→ [ SEWING ] ──→ [ WASHING ] ──→ [ QC ] ──→ [ PACKING ]
```

Each work center card shows:

- **Name** (e.g., "Cutting")
- **Type badge**: In-House or Subcontractor
- **Assigned items** (dropped from the left panel) with quantities
- **Vendor/subcon name** if applicable (e.g., "PT. Raymond Garment")
- **Allocated qty** (e.g., "800 of 1,000 pcs")

**Grouping behavior**: Work centers of the same type are visually grouped.[[2]](https://www.notion.so/Work-centers-can-be-grouped-by-type-e-g-Sewing-with-multiple-subcontractors-underneath-311e6626e75481d987b7c466f4f6396c?pvs=21) For example, "Sewing" is a group header, and hovering or expanding it reveals multiple subcontractors underneath:

```
┌─────────────────────────────────┐
│  SEWING (Group)                 │
│  ┌──────────────┐ ┌───────────┐ │
│  │ PT. Andi     │ │ In-House  │ │
│  │ 200 pcs      │ │ 800 pcs   │ │
│  │ Subcontractor│ │           │ │
│  └──────────────┘ └───────────┘ │
└─────────────────────────────────┘
```

This solves the problem of having 10-15 subcontractors for one process type -- you do not show all 15 boxes at the top level; you show one **grouped node** that expands on hover or click.[[3]](https://www.notion.so/The-system-needs-to-support-splitting-production-across-multiple-work-centers-for-the-same-product--311e6626e754815ca5bddd67f10eb965?pvs=21)

---

### Production Allocation (Splitting)

When a work center is clicked, the **Detail Drawer** at the bottom opens with a split-allocation table:

| Subcontractor | Type | Allocated Qty | Cost/Unit | Total Cost | Status | PT. Andi Garment | Subcon | 200 pcs | Rp 5,000 | Rp 1,000,000 | Pending |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| In-House Sewing Line 1 | In-House | 500 pcs | Rp 3,500 | Rp 1,750,000 | Pending | PT. Budi Konveksi | Subcon | 300 pcs | Rp 4,800 | Rp 1,440,000 | Pending |

The total must equal the production order quantity (1,000 pcs). The system validates this before SPK generation.

---

### Workflow: Step-by-Step

1. **Create/Select Product** -- from the Product Master (`/inventory/products`)
2. **Open BOM Editor** -- select existing BOM or create new version
3. **Add Items** -- search and add items to the left panel item bank, set qty per unit
4. **Build Routing** -- drag work center types from a top toolbar onto the canvas (Cutting, Sewing, Washing, QC, Packing, etc.)
5. **Assign Items to Work Centers** -- drag items from the left panel and drop onto the appropriate work center card
6. **Configure Work Centers** -- click each card to set in-house/subcon, vendor, cost, and quantity allocation
7. **Upload Patterns** -- attach pattern files, technical drawings, and spec sheets to the BOM[[4]](https://www.notion.so/The-BOM-module-needs-to-support-file-uploads-for-patterns-and-specifications-allowing-teams-to-atta-311e6626e75481f3bab5c1d431ac0109?pvs=21)
8. **Save and Generate SPK** -- system auto-generates sequential SPK (Work Orders) per work center, respecting dependencies[[5]](https://www.notion.so/Each-SPK-must-maintain-sequential-dependencies-later-stages-cannot-start-until-previous-stages-com-311e6626e75481b7a531fd46c611267e?pvs=21)

---

### SPK Auto-Generation Logic

Once the BOM routing is finalized, clicking **"Generate SPK"** creates work orders in sequence:

```
SPK-001 (Cutting)  ──→  SPK-002 (Sewing)  ──→  SPK-003 (Washing)  ──→  SPK-004 (QC)  ──→  SPK-005 (Packing)
     ↓                       ↓
  Materials consumed      Cannot start until
  at this stage           SPK-001 is complete
                          (or partially complete)
```

- Each SPK tracks which materials are consumed at that stage
- **Sequential dependency**: SPK-002 cannot start until SPK-001 is complete or partially complete[[5]](https://www.notion.so/Each-SPK-must-maintain-sequential-dependencies-later-stages-cannot-start-until-previous-stages-com-311e6626e75481b7a531fd46c611267e?pvs=21)
- **Partial processing** is supported -- if 500 of 1,000 pcs are cut, sewing can begin on those 500[[6]](https://www.notion.so/Partial-processing-is-supported-for-flexibility-in-production-scheduling-311e6626e754819a9966fd95579c750d?pvs=21)

---

### Connection to Accounting

The BOM feeds directly into the accounting module:

```
BOM (item qty x PR price)  ──→  HPP (Cost of Goods) per unit
                                      ↓
PO (1,000 pcs x sell price) ──→  Revenue per PO
                                      ↓
                              Profit & Loss per PO
```

- Clicking a PO in the accounting dashboard **drills down** to show material cost breakdown from the BOM[[7]](https://www.notion.so/Detailed-cost-breakdown-accessible-via-drill-down-clicking-PO-shows-material-costs-from-BOM-311e6626e7548172a384f341bc12f9cb?pvs=21)
- HPP is auto-calculated from purchase request prices[[8]](https://www.notion.so/HPP-cost-of-goods-automatically-calculated-from-purchase-request-prices-311e6626e75481e59e53eedd9fdecec7?pvs=21)
- This data is **read-only** in accounting -- edits must go back to the BOM or PR master[[9]](https://www.notion.so/Bisa-dilihat-It-should-be-if-the-system-works-well-it-can-t-be-edited-right-Because-the-name-is--311e6626e75480d0a406c0cf07809242?pvs=21)

---

This layout keeps the BOM editor as a **single-page experience** with the item bank on the left, the visual routing flow on the right, and details on click at the bottom -- no unnecessary page navigation. Want me to write this up as a spec page in your ERP workspace?
# BOM Revamp Design — Production BOM with Visual Flow Canvas

> Date: 2026-02-25
> Status: Approved
> Module: Manufacturing / BOM

---

## Problem Statement

The current BOM module is a basic CRUD list of materials per product. It does not:
- Show the production flow (which materials go to which work center)
- Support drag-and-drop routing definition
- Handle production allocation/splitting across subcontractors
- Support file attachments (patterns, specs)
- Auto-generate SPK (work orders) with sequential dependencies
- Calculate total production cost including labor/subcontract

Indonesian garment manufacturers need to see the full production pipeline visually: Cutting -> Sewing -> Washing -> QC -> Packing, with materials assigned per stage, and the ability to split production across in-house and CMT subcontractors.

## Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Data model | Merged (single ProductionBOM entity) | Fewer entities, matches the visual — the canvas IS the BOM |
| Work centers | New ProcessStation model | Clean separation from machine groups; supports in-house + subcontractor |
| Canvas library | @xyflow/react (React Flow) | Purpose-built for node diagrams, supports custom nodes, drag-drop, zoom/pan |
| File storage | Supabase Storage | Already integrated, auth built-in |
| Migration | Keep old tables, new tables alongside | No data loss, gradual migration |

---

## 1. Data Model

### 1.1 ProcessStation (NEW)

Represents a production stage (Cutting, Sewing, etc.) that can be in-house or subcontractor.

```prisma
model ProcessStation {
  id              String   @id @default(uuid())
  code            String   @unique
  name            String
  stationType     StationType
  operationType   OperationType
  subcontractorId String?
  subcontractor   Subcontractor? @relation(fields: [subcontractorId], references: [id])
  machineId       String?
  machine         Machine? @relation(fields: [machineId], references: [id])
  costPerUnit     Decimal  @default(0) @db.Decimal(12, 2)
  description     String?
  isActive        Boolean  @default(true)
  parentStationId String?
  parentStation   ProcessStation?  @relation("StationHierarchy", fields: [parentStationId], references: [id])
  childStations   ProcessStation[] @relation("StationHierarchy")
  bomSteps        ProductionBOMStep[]
  allocations     ProductionBOMAllocation[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("process_stations")
}

enum StationType {
  CUTTING
  SEWING
  WASHING
  PRINTING
  EMBROIDERY
  QC
  PACKING
  FINISHING
  OTHER
}

enum OperationType {
  IN_HOUSE
  SUBCONTRACTOR
}
```

**Hierarchy**: `parentStationId` allows grouping (e.g., "Sewing" parent with children "Sewing A - In-house", "Sewing B - PT Raymond").

### 1.2 ProductionBOM (NEW — replaces BillOfMaterials for new BOM page)

```prisma
model ProductionBOM {
  id                 String   @id @default(uuid())
  productId          String
  product            Product  @relation(fields: [productId], references: [id])
  version            String   @default("v1")
  isActive           Boolean  @default(true)
  totalProductionQty Int      @default(0)
  notes              String?
  items              ProductionBOMItem[]
  steps              ProductionBOMStep[]
  workOrders         WorkOrder[]
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@unique([productId, version])
  @@map("production_boms")
}
```

### 1.3 ProductionBOMItem (materials list)

```prisma
model ProductionBOMItem {
  id              String   @id @default(uuid())
  bomId           String
  bom             ProductionBOM @relation(fields: [bomId], references: [id], onDelete: Cascade)
  materialId      String
  material        Product  @relation(fields: [materialId], references: [id])
  quantityPerUnit Decimal  @db.Decimal(10, 4)
  unit            String?
  wastePct        Decimal  @default(0) @db.Decimal(5, 2)
  notes           String?
  stepMaterials   ProductionBOMStepMaterial[]

  @@map("production_bom_items")
}
```

### 1.4 ProductionBOMStep (flow canvas nodes)

```prisma
model ProductionBOMStep {
  id              String   @id @default(uuid())
  bomId           String
  bom             ProductionBOM @relation(fields: [bomId], references: [id], onDelete: Cascade)
  stationId       String
  station         ProcessStation @relation(fields: [stationId], references: [id])
  sequence        Int
  durationMinutes Int?
  notes           String?
  materials       ProductionBOMStepMaterial[]
  allocations     ProductionBOMAllocation[]
  attachments     ProductionBOMAttachment[]
  workOrders      WorkOrder[]

  @@unique([bomId, sequence])
  @@map("production_bom_steps")
}
```

### 1.5 ProductionBOMStepMaterial (drag-drop results)

```prisma
model ProductionBOMStepMaterial {
  id        String @id @default(uuid())
  stepId    String
  step      ProductionBOMStep @relation(fields: [stepId], references: [id], onDelete: Cascade)
  bomItemId String
  bomItem   ProductionBOMItem @relation(fields: [bomItemId], references: [id], onDelete: Cascade)

  @@unique([stepId, bomItemId])
  @@map("production_bom_step_materials")
}
```

### 1.6 ProductionBOMAllocation (production splitting)

```prisma
model ProductionBOMAllocation {
  id        String @id @default(uuid())
  stepId    String
  step      ProductionBOMStep @relation(fields: [stepId], references: [id], onDelete: Cascade)
  stationId String
  station   ProcessStation @relation(fields: [stationId], references: [id])
  quantity  Int
  notes     String?

  @@map("production_bom_allocations")
}
```

### 1.7 ProductionBOMAttachment (file uploads)

```prisma
model ProductionBOMAttachment {
  id         String   @id @default(uuid())
  stepId     String
  step       ProductionBOMStep @relation(fields: [stepId], references: [id], onDelete: Cascade)
  fileName   String
  fileUrl    String
  fileType   String
  fileSize   Int
  uploadedAt DateTime @default(now())

  @@map("production_bom_attachments")
}
```

### 1.8 WorkOrder modifications

Add fields to existing WorkOrder model:

```prisma
// Add to existing WorkOrder model:
productionBomId     String?
productionBom       ProductionBOM? @relation(fields: [productionBomId], references: [id])
productionBomStepId String?
productionBomStep   ProductionBOMStep? @relation(fields: [productionBomStepId], references: [id])
dependsOnWorkOrderId String?
dependsOnWorkOrder   WorkOrder? @relation("WODependency", fields: [dependsOnWorkOrderId], references: [id])
dependentWorkOrders  WorkOrder[] @relation("WODependency")
```

---

## 2. UI Layout

### 2.1 BOM List Page (`/manufacturing/bom`)

Existing card grid layout (refreshed styling). Each card shows:
- Product name + code
- Version badge
- Active/Inactive status
- Material count, step count
- Total estimated cost
- Click → opens Canvas Editor

**Actions**: Create New BOM, Search, Filter Active/All

### 2.2 Canvas Editor (full-page view: `/manufacturing/bom/[id]`)

```
┌─────────────────────────────────────────────────────────┐
│ TOOLBAR                                                 │
│ [< Back] Product: T-Shirt Basic | v1 | Qty: [100]      │
│ [Save] [Generate SPK] [Export PDF] [Duplicate]          │
├────────┬────────────────────────────────────────────────┤
│ LEFT   │                                                │
│ PANEL  │  REACT FLOW CANVAS                             │
│ (280px)│                                                │
│        │  ┌──────────┐     ┌──────────┐                │
│ MATERIALS │ Cutting  │────▶│ Sewing   │──▶ ...         │
│ ──────── │ (In-house)│     │ (Subcon) │                │
│ ◻ Fabric │ ─────────│     │ ─────────│                │
│   1.2m   │ ● Fabric  │     │ ● Thread │                │
│ ◻ Thread │ ● Lining  │     │ ● Button │                │
│   5m     │          │     │ ● Zipper │                │
│ ◻ Button │          │     │          │                │
│   4 pcs  └──────────┘     └──────────┘                │
│ ◻ Zipper│                                               │
│ ◻ Lining│  [+ Add Station]                              │
│ ◻ Plastic                                               │
│ ◻ HangTag                                               │
│        │                                                │
│ [+Add  │                                                │
│  Item] │                                                │
├────────┴────────────────────────────────────────────────┤
│ DETAIL PANEL (when node selected)                       │
│ Station: Sewing | Type: Subcontractor                   │
│ Duration: 45 min | Cost/unit: Rp 2.500                  │
│ ┌─ Allocations ──────────────────────────────────┐      │
│ │ Sewing A (PT Raymond): [80] pcs                │      │
│ │ Sewing B (Darren): [20] pcs                    │      │
│ │ [+ Add Allocation]                             │      │
│ └────────────────────────────────────────────────┘      │
│ ┌─ Attachments ──────────────────────────────────┐      │
│ │ pattern-v2.pdf (1.2 MB)  [x]                  │      │
│ │ sewing-spec.jpg (340 KB) [x]                   │      │
│ │ [+ Upload File]                                │      │
│ └────────────────────────────────────────────────┘      │
├─────────────────────────────────────────────────────────┤
│ FOOTER: Total: Rp 45.000/pc | Materials: 7 | Steps: 3  │
└─────────────────────────────────────────────────────────┘
```

### 2.3 Custom React Flow Nodes

Each process station node renders:
- Station name (bold header)
- Badge: "In-house" (green) or "Subcon: PT Name" (amber)
- Drop zone for materials (highlights on drag-over)
- List of assigned materials with qty
- Sequence number badge
- Mini cost indicator

### 2.4 Drag-and-Drop Mechanics

1. Materials in left panel are `draggable` elements
2. Station nodes have `onDrop` handlers (custom React Flow node)
3. On drop: creates `ProductionBOMStepMaterial` record
4. Materials do NOT disappear from left panel after drag (one material can be assigned to multiple steps)
5. Remove material from step: click X on the material chip inside the node
6. Reorder steps: drag nodes or use sequence number inputs

---

## 3. SPK (Work Order) Auto-Generation

### Trigger
User clicks "Generate SPK" button on canvas toolbar.

### Validation (pre-generation)
- All steps must have at least one material assigned
- Steps with subcontractor stations must have allocations totaling `totalProductionQty`
- In-house steps auto-allocate full qty

### Generation Logic (in a Prisma transaction)

```
For each ProductionBOMStep (ordered by sequence):
  1. If step has allocations (subcontractor splitting):
     For each allocation:
       - Create WorkOrder (qty = allocation.quantity)
       - If station is subcontractor → create SubcontractOrder
  2. If step is in-house (no allocations):
     - Create single WorkOrder (qty = totalProductionQty)
  3. Set dependsOnWorkOrderId to previous step's WO(s)
  4. Attach material requirements from ProductionBOMStepMaterial
```

### Sequential Dependencies
- WO for Step N has `dependsOnWorkOrderId` → WO for Step N-1
- If Step N-1 has multiple WOs (split), Step N depends on ALL of them
- Partial processing: Step N can start when Step N-1 has `actualQty > 0`

### Result
- Returns list of created WOs with their SPK numbers
- User sees confirmation dialog: "Created 5 SPKs: MO-202602-0001 through MO-202602-0005"

---

## 4. PDF Report (Typst Template)

### Page 1 — Cover
- Company header
- Product: name, code, image placeholder
- BOM version, total production qty
- Date, estimated total cost

### Page 2+ — Production Steps
For each step (sequence order):
- **Step N: [Station Name]** — [In-house / Subcontractor: PT Name]
- Allocation: X pieces
- Duration: Y minutes
- Materials table:

| Material | Qty/Unit | Total Qty | Unit | Cost | Subtotal |
|----------|----------|-----------|------|------|----------|
| Fabric   | 1.2 m    | 120 m     | m    | 10k  | 1.2M     |

- Attachments list (file names, not embedded)

### Last Page — Summary
- Full BOM table (all materials, total cost)
- Cost breakdown: Materials + Labor + Subcontract = Total
- Cost per piece

---

## 5. API Endpoints

### New Endpoints
- `GET /api/manufacturing/process-stations` — list all stations (with hierarchy)
- `POST /api/manufacturing/process-stations` — create station
- `PATCH /api/manufacturing/process-stations/[id]` — update station
- `GET /api/manufacturing/production-bom` — list all production BOMs
- `POST /api/manufacturing/production-bom` — create new production BOM
- `GET /api/manufacturing/production-bom/[id]` — full BOM with steps, materials, allocations, attachments
- `PATCH /api/manufacturing/production-bom/[id]` — update BOM (save canvas state)
- `DELETE /api/manufacturing/production-bom/[id]` — delete BOM
- `POST /api/manufacturing/production-bom/[id]/generate-spk` — auto-generate work orders
- `POST /api/manufacturing/production-bom/[id]/attachments` — upload file to Supabase Storage
- `DELETE /api/manufacturing/production-bom/attachments/[id]` — delete attachment
- `GET /api/manufacturing/production-bom/[id]/pdf` — generate PDF report

### Modified Endpoints
- `GET /api/manufacturing/work-orders` — include `dependsOnWorkOrderId` and `productionBomStep` in response

---

## 6. File Structure

```
app/manufacturing/bom/
├── page.tsx (list view — server component)
├── bom-list-client.tsx (card grid with search/filter)
├── [id]/
│   └── page.tsx (canvas editor — full page)
└── loading.tsx

components/manufacturing/bom/
├── bom-canvas.tsx (React Flow wrapper)
├── station-node.tsx (custom React Flow node)
├── material-panel.tsx (left sidebar, draggable items)
├── detail-panel.tsx (bottom panel — allocations, attachments)
├── create-bom-dialog.tsx (updated — product + version only)
├── create-station-dialog.tsx (add new process station)
├── allocation-editor.tsx (split production qty)
├── attachment-uploader.tsx (Supabase Storage upload)
└── bom-pdf-button.tsx (trigger PDF generation)

app/api/manufacturing/
├── process-stations/
│   ├── route.ts (GET/POST)
│   └── [id]/route.ts (GET/PATCH/DELETE)
├── production-bom/
│   ├── route.ts (GET/POST)
│   └── [id]/
│       ├── route.ts (GET/PATCH/DELETE)
│       ├── generate-spk/route.ts (POST)
│       ├── attachments/route.ts (POST)
│       └── pdf/route.ts (GET)
└── production-bom-attachments/
    └── [id]/route.ts (DELETE)

templates/production_bom/
└── main.typ (Typst PDF template)
```

---

## 7. Migration Strategy

1. **New Prisma migration**: Add all 7 new tables + WO fields
2. **Keep old tables**: `bill_of_materials` and `bom_items` remain untouched
3. **BOM page**: Completely replaced with new canvas UI
4. **No data migration required**: Old BOMs stay accessible via API if needed; new BOMs are created fresh
5. **Install @xyflow/react**: `npm install @xyflow/react`

---

## 8. Implementation Order

1. Schema migration (new tables + WO fields)
2. ProcessStation CRUD (API + simple management UI)
3. ProductionBOM CRUD API (without canvas)
4. React Flow canvas editor (core drag-drop)
5. Material panel + drag to nodes
6. Allocation editor (production splitting)
7. Attachment uploader (Supabase Storage)
8. SPK generation logic
9. PDF report (Typst template)
10. BOM list page refresh

# AGENT OPERATION CATALOG — Procurement Slice (PR → PO → GRN)

> **Status:** DESIGN. No code written. Every `path:line` below was read and verified on **2026-07-27**.
> **Companion:** `AGENT_CONTROL_PLANE_ARCHITECTURE.md` (layers, boundaries, traced proof),
> `AGENT_SAFETY_MODEL.md` (capabilities, SoD, thresholds), `AGENT_PHASE0_GATE.md` (what must ship first).
>
> **Version:** catalog `v1.0.0-draft`. Operation versions are independent and semver'd per operation.

---

## 1. Binding rules (enforced, not advisory)

1. **Canonical modules only.** An operation may import from `lib/actions/procurement.ts`,
   `lib/actions/grn.ts`, `lib/actions/finance-invoices.ts`, `lib/actions/finance-ap.ts`,
   `lib/actions/finance-ar.ts`, `lib/actions/finance-gl.ts`, `lib/actions/inventory-gl.ts`.
   **`lib/actions/finance.ts` is forbidden** — `CLAUDE.md` declares it stale, and 14 live UI files still
   import it (verified: `app/finance/bills/page.tsx:48`, `app/finance/vendor-payments/page.tsx:30`,
   `app/finance/journal/new/page.tsx:28`, `app/finance/expenses/page.tsx:25`,
   `app/finance/receivables/receivables-client.tsx:12`, `app/finance/payables/page.tsx:2`,
   `app/finance/payables/payables-client.tsx:13`, `app/accountant/coa/page.tsx:5`,
   `app/actions/dashboard.ts:4`, `components/finance/accounting-module-actions.tsx:18`,
   `components/finance/vendor-multi-payment-dialog.tsx:34`, `components/finance/nota-kredit-tab.tsx:17`,
   `components/finance/nota-debit-tab.tsx:15`, `components/finance/journal/create-journal-dialog.tsx:29`).
   The agent must not drive the broken copies.
2. **No raw Prisma in `lib/agent/**`.** Where a needed read has no canonical action, the read is
   **added to the canonical module** (Phase 0 item G-09) — not written inline in the agent layer.
3. **No generic CRUD.** No `updateEntity`, no `setField`, no `query`. Business verbs only.
4. **No delete operations.** Corrections are `reverse*` / `reject*` operations that post a counter-entry
   or a guarded status transition. This catalog contains zero deletes and never will.
5. **Non-atomic ⇒ not exposed.** If the canonical action is non-atomic, unguarded, or unauthenticated,
   the operation is listed here as `exposure: BLOCKED` with its Phase 0 gate item, and the MCP server
   does not emit a tool for it.
6. **≤ 8 top-level input fields**, ≤ 1 level of nesting (one array of line items is allowed). Anything
   larger is the wrong granularity and must be split.

---

## 2. Descriptor shape

```ts
interface OperationDescriptor<I, O> {
  id: string                       // `domain.verbNoun`, stable forever
  version: string                  // semver; breaking input change ⇒ major, new id suffix `@2`
  title_id: string;  title_en: string
  description_id: string; description_en: string

  inputSchema: z.ZodType<I>        // flat, enums, explicit units/currency, ISO dates
  outputSchema: z.ZodType<O>

  riskTier: 'READ' | 'WRITE_LOW' | 'WRITE_MONEY' | 'IRREVERSIBLE'
  requiredCapability: string       // matched against the session grant, see SAFETY §2
  sideEffects: {
    documentsCreated: string[]     // model names + status they land in
    documentsMutated: string[]
    glAccountsTouched: { code: string; name: string; direction: 'DR' | 'CR' }[]
    stockMoved: 'none' | 'increase' | 'decrease'
    downstreamTriggers: string[]   // out-of-transaction effects, named honestly
  }
  dryRunSupported: boolean         // MUST be true for every non-READ
  idempotent: boolean              // MUST be true for every non-READ (via AgentOperationRecord)
  reversalOperation: string | null // the op that undoes it; null only for READ / already-a-reversal
  preconditions: string[]          // machine-checkable, evaluated in the tx before any write
  boundAction: string              // `path:line` of the canonical action
  exposure: 'STAGE_1' | 'STAGE_3' | 'BLOCKED'
  blockedBy?: string[]             // Phase 0 gate item ids
  examples: { name: string; input: I; result: AgentResultShape }[]
}
```

**Shared input conventions.** Every mutation carries these; they are omitted from the per-operation
schemas below to avoid repetition.

```ts
const MutationEnvelope = z.object({
  idempotencyKey: z.string().uuid()
    .describe('id: Kunci idempotensi (UUID v4), wajib. Ulangi kunci yang SAMA saat retry. | ' +
              'en: Idempotency key (UUID v4), required. Reuse the SAME key when retrying.'),
  dryRun: z.boolean().default(true)
    .describe('id: true = simulasi saja, tidak menulis apa pun. | en: true = simulate only, writes nothing.'),
  reason_id: z.string().min(10).max(500).optional()
    .describe('id: Alasan bisnis dalam Bahasa Indonesia, tampil di kartu persetujuan. | ' +
              'en: Business reason in Bahasa, shown on the approval card.'),
})
```

- **Currency** is always `…Idr`, integer rupiah, no decimals, no float. (`Decimal(20,2)` in the DB; the
  agent never sees a float and never sees an unlabelled number.)
- **Quantity** is always `quantity` + `unit` (unit echoed from `Product.unit`, `schema.prisma:219`).
- **Dates** are ISO-8601 `YYYY-MM-DD` strings, interpreted in `Asia/Jakarta`.
- **Ids** are UUID strings. The agent never constructs one; it always echoes an id from a read.

---

## 3. Catalog summary

### 3.1 Read operations (10) — `riskTier: READ`

| # | Operation id | Bound canonical action | Exposure | Note |
|---|---|---|---|---|
| R-1 | `procurement.listPurchaseRequests` | `procurement.ts:459` `getPurchaseRequests` | STAGE_1 | fallback at `:497-499` must be removed (G-07) |
| R-2 | `procurement.getPurchaseRequest` | **to add** `getPurchaseRequestById` (G-09) | STAGE_1 | detail read does not exist today |
| R-3 | `procurement.listPurchaseOrders` | `procurement.ts:1334` `getAllPurchaseOrders` | STAGE_1 | **returns `FALLBACK_PURCHASE_ORDERS` at `:1385-1387`** (G-07) |
| R-4 | `procurement.getPurchaseOrder` | **to add** `getPurchaseOrderById` (G-09) | STAGE_1 | |
| R-5 | `procurement.listPurchaseOrdersAwaitingReceipt` | `grn.ts:76` `getPendingPOsForReceiving` | STAGE_1 | double fallback `:79-98` **and** `:134-137` (G-07) |
| R-6 | `procurement.listGoodsReceipts` | `grn.ts:144` `getAllGRNs` | STAGE_1 | `catch → []` at `:189-192` (G-07) |
| R-7 | `procurement.getGoodsReceipt` | `grn.ts:199` `getGRNById` | STAGE_1 | `catch → null` at `:252-255` (G-07) |
| R-8 | `procurement.searchSuppliers` | `procurement.ts:114` `getVendors` | STAGE_1 | **returns `FALLBACK_VENDORS` at `:157-159`** (G-07) |
| R-9 | `inventory.searchProducts` | **to add** `getProductsForProcurement` (G-09) | STAGE_1 | existing `app/actions/purchase-order.ts:36-38` has a fallback |
| R-10 | `inventory.getStockLevel` | **to add** `getStockLevelForProduct` (G-09) | STAGE_1 | |

### 3.2 Mutating operations (14)

| # | Operation id | Risk | Bound action | Guard status (verified) | Exposure |
|---|---|---|---|---|---|
| W-1 | `procurement.createPurchaseRequest` | WRITE_LOW | `procurement.ts:503` | number atomic `:546`; creates at `PENDING` | STAGE_1 |
| W-2 | `procurement.approvePurchaseRequest` | WRITE_LOW | `procurement.ts:582` | ✅ guarded `updateMany` `:618-627` | STAGE_1 |
| W-3 | `procurement.rejectPurchaseRequest` | WRITE_LOW | `procurement.ts:710` | ❌ **unguarded** `update` `:742` | **BLOCKED** G-03 |
| W-4 | `procurement.convertRequestToOrder` | WRITE_LOW | `procurement.ts:770` | ✅ guarded item dedupe `:893-901`; number atomic `:850` | STAGE_1 |
| W-5 | `procurement.submitOrderForApproval` | WRITE_LOW | `procurement.ts:933` | ❌ **unguarded** `update` `:945` | **BLOCKED** G-03 |
| W-6 | `procurement.approvePurchaseOrder` | **WRITE_MONEY** | `procurement.ts:970` | ✅ guarded `:991-1001`, SoD `:983-987`; ⚠️ bill outside tx `:1019` | STAGE_1 (human-gated) |
| W-7 | `procurement.rejectPurchaseOrder` | WRITE_LOW | `procurement.ts:1030` | ❌ **unguarded** `update` `:1042` | **BLOCKED** G-03 |
| W-8 | `procurement.markOrderAsSent` | WRITE_LOW | `procurement.ts:1155` | ✅ guarded `:1167` + count `:1175` | STAGE_1 |
| W-9 | `procurement.markOrderVendorConfirmed` | WRITE_LOW | `procurement.ts:1194` | ✅ guarded `:1206-1213` | STAGE_1 |
| W-10 | `procurement.markOrderShipped` | WRITE_LOW | `procurement.ts:1233` | ✅ guarded `:1245-1252` | STAGE_1 |
| W-11 | `procurement.createGoodsReceipt` | WRITE_LOW | `grn.ts:262` | number atomic `:282`; qty check `:332-341` | STAGE_1 |
| W-12 | `procurement.receiveGoods` | **WRITE_MONEY** | `grn.ts:382` | ✅ fully atomic, GL blocking — **the traced operation** | STAGE_1 (human-gated) |
| W-13 | `procurement.rejectGoodsReceipt` | WRITE_LOW | `grn.ts:684` | ✅ guarded `:693-713` | STAGE_1 |
| W-14 | `procurement.reversePurchaseReceipt` | **IRREVERSIBLE** | `procurement.ts:2530` | ❌ no `assertRole` `:2531`; unguarded `returnedQty` `:2648-2651` | **BLOCKED** G-03 + G-10 |

### 3.3 Meta operations (3)

| # | Operation id | Purpose |
|---|---|---|
| M-1 | `agent.describeCapabilities` | OData `$metadata` equivalent — discover operations, schemas, limits, grant headroom |
| M-2 | `agent.confirmProposal` | Execute a previously-returned `proposalId` |
| M-3 | `agent.cancelProposal` | Explicitly abandon a proposal (frees the concurrency slot, logs the abandonment) |

**Stage-1 MCP tool count: 10 reads + 10 exposed mutations + 3 meta = 23 tools.** Within the ≤30 budget
with room for the next domain's discovery tool.

### 3.4 Explicitly excluded from the catalog — and why

These exist in `lib/actions/procurement.ts` and are **deliberately not agent-callable**. Recorded so the
exclusion is a decision, not an oversight.

| Action | `path:line` | Why excluded |
|---|---|---|
| `cancelPurchaseOrder` | `:1069` | **No auth check at all** (no `getAuthzUser`, no `assertRole`) on an action that voids vendor bills (`:1130-1140`) and resets PR items (`:1109-1112`). Also **currently broken**: the callback is declared `async (prisma, user) =>` at `:1071` but `withPrismaAuth`'s signature passes only one argument (`lib/db.ts:42`), so `user.id` at `:1118` throws a `TypeError` on every call and the whole cancel rolls back. Fix and re-review before any exposure. |
| `createVendor` | `:1545` | **No `assertRole`.** Master data. Creating a supplier is the highest-value injection target in the slice — a supplier row carries `bankName`/`bankAccountNumber`/`bankAccountName` (`schema.prisma:1127-1129`). Master data is out of scope for Stage 1 by policy, not just by defect. |
| `updateVendor` / `deactivateVendor` | `:2061` / `:2158` | Same reason. Editing supplier bank details is where procurement fraud lives; it stays human-only. |
| `saveLandedCost` | `:1834` | **No role check**, posts GL (`postInventoryGLEntry` at `:1905`), and falls back to `warehouseId: ""` when no stock row is found (`:1892-1895`), writing an empty FK into `inventoryTransaction`. |
| `createDirectPurchase` | `:2229` | The strongest-written action in the file (fully transactional, GL rolls back at `:2439-2441`) but it **collapses PR→PO→GRN→Bill into one call**, bypassing the entire approval chain the tiered-autonomy model depends on. Excluded on control grounds, not quality grounds. |
| `savePOAsTemplate` / `createPOFromTemplate` | `:1660` / `:1746` | No auth check; template indirection lets a stored object determine what gets ordered — an injection sink. |
| `confirmPurchaseOrder` | `:1271` | Unguarded `update` `:1287`, then re-reads on the **bare global `prisma`** outside the tx at `:1307` and swallows the bill failure at `:1315-1316`. |
| Any delete | — | Rule 4. None exist in the catalog. |

---

## 4. Full descriptors

Below, `⟶` marks the canonical binding. `AgentResult` fields common to all responses are per
`AGENT_CONTROL_PLANE_ARCHITECTURE.md §4`.

---

### R-1 · `procurement.listPurchaseRequests` — v1.0.0

⟶ `lib/actions/procurement.ts:459` `getPurchaseRequests`

- **title_id** Daftar Permintaan Pembelian · **title_en** List purchase requests
- **description_id** Menampilkan daftar permintaan pembelian (PR) dengan filter status dan departemen. Hanya membaca; tidak mengubah apa pun.
- **description_en** Lists purchase requests (PR) filtered by status and department. Read-only.
- **riskTier** `READ` · **requiredCapability** `procurement.read` · **dryRunSupported** n/a · **idempotent** yes · **reversalOperation** null

```ts
inputSchema: z.object({
  status: z.enum(['DRAFT','PENDING','APPROVED','REJECTED','CANCELLED','PO_CREATED']).optional()
    .describe('id: Status PR. | en: PR status.'),           // PRStatus, schema.prisma:1355-1362
  department: z.string().max(80).optional()
    .describe('id: Nama departemen pemohon. | en: Requesting department name.'),
  requestedFrom: z.string().date().optional().describe('id: Tanggal awal (YYYY-MM-DD). | en: From date.'),
  requestedTo:   z.string().date().optional().describe('id: Tanggal akhir (YYYY-MM-DD). | en: To date.'),
  pageSize: z.number().int().min(1).max(100).default(25)
    .describe('id: Jumlah baris (maks 100). | en: Rows to return (max 100).'),
  cursor: z.string().optional().describe('id: Kursor halaman berikutnya. | en: Next-page cursor.'),
})

outputSchema: z.object({
  items: z.array(z.object({
    id: z.string().uuid(), number: z.string(), status: z.string(),
    requestDate: z.string().date(), department: z.string().nullable(),
    requesterName: z.string(), itemCount: z.number().int(),
    estimatedValueIdr: z.number().int().nullable(),
  })),
  nextCursor: z.string().nullable(),
  totalMatching: z.number().int(),
})
```

- **preconditions** — grant includes `procurement.read`; `pageSize ≤ 100`.
- **sideEffects** — none.
- **Phase 0 dependency** — `getPurchaseRequests` currently does `catch → return []` at `:497-499`.
  The operation must call a variant that throws, and map the throw to `code:'READ_FAILED', retryable:true`.
  **An empty list must mean empty, never "the database was unreachable."**

---

### R-5 · `procurement.listPurchaseOrdersAwaitingReceipt` — v1.0.0

⟶ `lib/actions/grn.ts:76` `getPendingPOsForReceiving`

- **title_id** Daftar PO Menunggu Penerimaan · **title_en** List POs awaiting goods receipt
- **description_id** Menampilkan pesanan pembelian yang masih punya sisa barang untuk diterima, beserta sisa kuantitas per item.
- **description_en** Lists purchase orders that still have quantity outstanding, with the remaining quantity per line.
- **riskTier** `READ` · **requiredCapability** `procurement.read`

```ts
inputSchema: z.object({
  supplierId: z.string().uuid().optional().describe('id: Filter pemasok. | en: Filter by supplier.'),
  pageSize: z.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
})

outputSchema: z.object({
  items: z.array(z.object({
    purchaseOrderId: z.string().uuid(), number: z.string(),
    supplierId: z.string().uuid(), supplierName: z.string(),
    status: z.enum(['APPROVED','ORDERED','VENDOR_CONFIRMED','SHIPPED','PARTIAL_RECEIVED']),
    orderDate: z.string().date(), expectedDate: z.string().date().nullable(),
    totalAmountIdr: z.number().int(),
    lines: z.array(z.object({
      poItemId: z.string().uuid(), productId: z.string().uuid(),
      productCode: z.string(), productName: z.string(), unit: z.string(),
      orderedQty: z.number(), receivedQty: z.number(), remainingQty: z.number(),
      unitPriceIdr: z.number().int(),
    })),
  })),
  nextCursor: z.string().nullable(),
})
```

- **Phase 0 dependency — the worst read in the slice.** It swallows twice: `safeQuery(..., FALLBACK_PENDING_POS)`
  at `grn.ts:79-98` (which **discards the `error` field** the wrapper returns — `lib/db.ts:209` returns
  `{data, error, fromCache}` and `grn.ts:79` destructures only `{data: orders}`), then `catch → return []`
  at `:134-137`. During a DB blip this operation confidently tells the agent **"tidak ada PO yang menunggu
  penerimaan"**. Blocked on G-07.

---

### R-8 · `procurement.searchSuppliers` — v1.0.0

⟶ `lib/actions/procurement.ts:114` `getVendors`

- **title_id** Cari Pemasok · **title_en** Search suppliers
- **riskTier** `READ` · **requiredCapability** `procurement.read`

```ts
inputSchema: z.object({
  query: z.string().min(2).max(80).optional()
    .describe('id: Cari berdasarkan nama atau kode pemasok. | en: Match supplier name or code.'),
  activeOnly: z.boolean().default(true),
  pageSize: z.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
})

outputSchema: z.object({
  items: z.array(z.object({
    id: z.string().uuid(), code: z.string(), name: z.string(),
    isActive: z.boolean(), paymentTerm: z.string(),
    rating: z.number().int().min(0).max(5), onTimeRatePct: z.number().int(),
    hasNpwp: z.boolean(),          // boolean only — the NPWP value itself is not agent-visible
  })),
  nextCursor: z.string().nullable(),
})
```

- **Redaction rule.** `bankName` / `bankAccountNumber` / `bankAccountName` (`schema.prisma:1127-1129`) and
  the literal `npwp` (`:1131`) are **never** returned to the agent. The agent has no operation that needs
  them and no capability to change them; exposing them only creates an exfiltration target.
- **Provenance rule.** `name` is attacker-influenced free text. It is returned inside the `data` channel
  and any downstream operation whose parameters derive from it is stamped `provenance:'ERP_TEXT'`
  (`AGENT_SAFETY_MODEL.md §5`).
- **Phase 0 dependency** — `catch → return FALLBACK_VENDORS` at `:157-159` returns **fabricated supplier
  rows**. An agent could raise a PR against a supplier that does not exist. Blocked on G-07.

---

### R-10 · `inventory.getStockLevel` — v1.0.0

⟶ **to add:** `getStockLevelForProduct` in the canonical inventory action module (Phase 0 item G-09)

- **title_id** Cek Stok Produk · **title_en** Get product stock level
- **riskTier** `READ` · **requiredCapability** `inventory.read`

```ts
inputSchema: z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid().optional()
    .describe('id: Kosongkan untuk melihat semua gudang. | en: Omit for all warehouses.'),
})
outputSchema: z.object({
  productId: z.string().uuid(), productCode: z.string(), productName: z.string(), unit: z.string(),
  levels: z.array(z.object({
    warehouseId: z.string().uuid(), warehouseName: z.string(),
    quantity: z.number(), reservedQty: z.number(), availableQty: z.number(),
  })),
  ledgerReconciles: z.boolean()
    .describe('id: true bila StockLevel cocok dengan jumlah InventoryTransaction. | ' +
              'en: true when StockLevel matches the sum of InventoryTransaction.'),
})
```

- **`ledgerReconciles` is not decoration.** `StockLevel.quantity` is `Decimal(18,4)` (`schema.prisma:381`)
  while `InventoryTransaction.quantity` is `Int` (`schema.prisma:408`). For any fractional-unit product
  (fabric in metres — the core of a textile ERP) the two **cannot** agree. The agent is told so explicitly
  rather than being allowed to assume the number is trustworthy. See gate item G-11.

---

### W-1 · `procurement.createPurchaseRequest` — v1.0.0

⟶ `lib/actions/procurement.ts:503` `createPurchaseRequest`

- **title_id** Buat Permintaan Pembelian · **title_en** Create purchase request
- **description_id** Membuat permintaan pembelian (PR) baru berstatus MENUNGGU PERSETUJUAN. Belum ada uang yang bergerak dan belum ada jurnal.
- **description_en** Creates a new purchase request in PENDING status. No money moves and no journal entry is posted.
- **riskTier** `WRITE_LOW` · **requiredCapability** `procurement.pr.create`
- **dryRunSupported** `true` · **idempotent** `true` · **reversalOperation** `procurement.rejectPurchaseRequest` (BLOCKED — see §5)

```ts
inputSchema: MutationEnvelope.extend({
  department: z.string().min(2).max(80)
    .describe('id: Departemen yang meminta. | en: Requesting department.'),
  priority: z.enum(['LOW','NORMAL','HIGH','URGENT']).default('NORMAL')
    .describe('id: Prioritas permintaan. | en: Request priority.'),
  neededByDate: z.string().date()
    .describe('id: Tanggal barang dibutuhkan (YYYY-MM-DD). | en: Date goods are needed.'),
  notes_id: z.string().max(500).optional()
    .describe('id: Catatan untuk penyetuju, Bahasa Indonesia. | en: Note for the approver, in Bahasa.'),
  lines: z.array(z.object({
    productId: z.string().uuid().describe('id: Ambil dari inventory.searchProducts. | en: From inventory.searchProducts.'),
    quantity: z.number().positive().describe('id: Jumlah diminta. | en: Quantity requested.'),
    unit: z.string().max(12).describe('id: Satuan, harus sama dengan satuan produk. | en: Unit, must match the product unit.'),
    preferredSupplierId: z.string().uuid().optional(),
    notes_id: z.string().max(200).optional(),
  })).min(1).max(50).describe('id: Baris permintaan (maks 50). | en: Request lines (max 50).'),
})

outputSchema: z.object({
  purchaseRequestId: z.string().uuid(),
  number: z.string(),                 // e.g. "PR-202607-0042"
  status: z.literal('PENDING'),
  lineCount: z.number().int(),
  estimatedValueIdr: z.number().int().nullable(),
})
```

- **sideEffects** — `documentsCreated: ['PurchaseRequest(PENDING)', 'PurchaseRequestItem(PENDING)×N']`;
  `glAccountsTouched: []`; `stockMoved: 'none'`; `downstreamTriggers: ['revalidateProcurementPaths()']`.
- **preconditions**
  1. Every `productId` exists and is active.
  2. Every `unit` equals `Product.unit` (mismatched units are the most common agent error and become
    a wrong-quantity PO three steps later).
  3. `neededByDate ≥ today`.
  4. The grant's `scope.departments` includes `department` (an agent scoped to *Produksi* cannot raise a
    PR for *Keuangan*).
  5. **Line-value ceiling:** `Σ(quantity × Product.costPrice) ≤ grant.limits.prMaxValueIdr`.
- **Design notes on the binding**
  - The canonical action takes `getAuthzUser()` at `:511` and deliberately has **no `assertRole`** — any
    authenticated user may raise a PR. The operation layer therefore supplies the *only* authorization,
    via `procurement.pr.create` + department scope.
  - Numbering is already atomic: `getNextDocNumber(prisma, prefix, 4)` at `:546` inside the transaction.
  - **The PR is created directly at `PENDING`** (`:557`, items `PENDING` at `:567`). There is **no
    `submitPurchaseRequest` action anywhere in the repo** and the `PRStatus.DRAFT` value
    (`schema.prisma:1356`) is unreachable through this path. The catalog does not invent a submit step;
    creation *is* submission, and the propose→confirm gate is what makes that safe.

**Worked example — dry run**

```jsonc
// → procurement.createPurchaseRequest
{
  "idempotencyKey": "7d1f0c2a-2b44-4a0e-9f31-6c0b5a1e77d2",
  "dryRun": true,
  "department": "Produksi",
  "priority": "HIGH",
  "neededByDate": "2026-08-10",
  "notes_id": "Stok kain katun tinggal 1 minggu produksi.",
  "lines": [
    { "productId": "b2f1…", "quantity": 500, "unit": "meter", "preferredSupplierId": "a91c…" }
  ]
}
```

```jsonc
// ← AgentResult
{
  "ok": true, "replayed": false,
  "correlationId": "ep_2026-07-27_0913_a41c",
  "operationId": "procurement.createPurchaseRequest", "operationVersion": "1.0.0",
  "messages": [{
    "severity": "I", "code": "DRY_RUN_OK",
    "message_id": "Simulasi berhasil. PR akan dibuat dengan 1 baris, nilai estimasi Rp 22.500.000. Belum ada yang tersimpan.",
    "message_en": "Simulation succeeded. PR would be created with 1 line, estimated value Rp 22,500,000. Nothing was saved."
  }],
  "retryable": false,
  "simulation": {
    "journalLines": [],
    "stockDeltas": [],
    "statusChanges": [],
    "documentsCreated": [{ "type": "PurchaseRequest", "previewNumber": "PR-202607-<berikutnya>" }]
  },
  "data": {
    "proposalId": "prop_01J8Z…",
    "expiresAt": "2026-07-27T09:28:00+07:00",
    "diff_id": "AKAN DIBUAT — Permintaan Pembelian\n  Departemen : Produksi\n  Prioritas  : TINGGI\n  Dibutuhkan : 10 Agustus 2026\n  Baris 1    : Kain Katun 30s (KAT-30S) — 500 meter @ Rp 45.000 = Rp 22.500.000\n  Total estimasi: Rp 22.500.000\n  Jurnal     : tidak ada (PR belum menimbulkan kewajiban)",
    "diff_en": "WILL CREATE — Purchase Request …"
  }
}
```

**Worked example — schema-repair error**

```jsonc
// → lines[0].unit = "m" but Product.unit = "meter"
{
  "ok": false, "retryable": false,
  "messages": [{
    "severity": "E", "code": "UNIT_MISMATCH",
    "message_id": "Satuan tidak cocok untuk produk KAT-30S. Diharapkan \"meter\", diterima \"m\".",
    "message_en": "Unit mismatch for product KAT-30S. Expected \"meter\", received \"m\".",
    "field": "lines[0].unit"
  }],
  "fieldErrors": [{ "severity":"E", "code":"UNIT_MISMATCH", "field":"lines[0].unit",
                    "message_id":"Gunakan \"meter\". Contoh: {\"quantity\": 500, \"unit\": \"meter\"}",
                    "message_en":"Use \"meter\". Example: {\"quantity\": 500, \"unit\": \"meter\"}" }],
  "remediation": {
    "message_id": "Panggil inventory.searchProducts untuk mendapatkan satuan resmi produk, lalu ulangi dengan kunci idempotensi yang SAMA.",
    "message_en": "Call inventory.searchProducts to get the product's canonical unit, then retry with the SAME idempotency key.",
    "suggestedOperation": "inventory.searchProducts"
  }
}
```

Note the remediation says *reuse the same key*: nothing was written, so the key is free (the
`AgentOperationRecord` insert rolled back with the transaction).

---

### W-2 · `procurement.approvePurchaseRequest` — v1.0.0

⟶ `lib/actions/procurement.ts:582` `approvePurchaseRequest`

- **title_id** Setujui Permintaan Pembelian · **title_en** Approve purchase request
- **description_id** Menyetujui PR sehingga bisa dikonversi menjadi Pesanan Pembelian. Belum ada jurnal.
- **riskTier** `WRITE_LOW` · **requiredCapability** `procurement.pr.approve`
- **dryRunSupported** `true` · **idempotent** `true` · **reversalOperation** `procurement.rejectPurchaseRequest` (BLOCKED)

```ts
inputSchema: MutationEnvelope.extend({
  purchaseRequestId: z.string().uuid(),
  expectedStatus: z.literal('PENDING')
    .describe('id: Status yang Anda lihat saat membaca PR — dipakai untuk deteksi perubahan. | ' +
              'en: The status you observed when reading the PR — used for drift detection.'),
})
outputSchema: z.object({
  purchaseRequestId: z.string().uuid(), number: z.string(),
  status: z.literal('APPROVED'), itemsApproved: z.number().int(),
})
```

- **sideEffects** — mutates `PurchaseRequest.status → APPROVED` and all `PENDING`
  `PurchaseRequestItem.status → APPROVED` (`:628-631`); no GL, no stock.
- **preconditions** — PR is `PENDING`; grant capability; **SoD:** the grant's `onBehalfOfHuman` must not be
  the PR's `requesterId` (see `AGENT_SAFETY_MODEL.md §3`); department scope satisfied (mirrors the
  canonical `canApproveForDepartment` check at `:606-614`).
- **Why this binding is safe.** The canonical action already does the right thing: guarded
  `updateMany({where:{id, status:'PENDING'}})` + `count===0 ⇒ throw` at `:618-627`. The operation adds
  `expectedStatus` so that a *stale read* is caught with a clean `PROPOSAL_STALE` before the write,
  rather than surfacing the raw Bahasa string `'PR sudah diproses oleh pengguna lain. Refresh halaman.'`
  from `:626` — which an agent cannot pattern-match reliably. **Error strings become stable codes.**

**Error mapping**

| Canonical throw | `path:line` | Agent code | severity | retryable |
|---|---|---|---|---|
| `'PR sudah diproses oleh pengguna lain…'` | `:626` | `PR_ALREADY_PROCESSED` | E | false |
| department mismatch | `:606-614` | `SCOPE_DENIED` | E | false |
| `'Unauthorized'` from `getAuthzUser` | `lib/authz.ts:16` | `GRANT_INVALID` | A | false |
| `P2024` / `P1001` | Prisma | `DB_UNAVAILABLE` | E | **true**, `retryAfterMs: 2000` |

---

### W-4 · `procurement.convertRequestToOrder` — v1.0.0

⟶ `lib/actions/procurement.ts:770` `convertPRToPO`

- **title_id** Ubah PR Menjadi Pesanan Pembelian · **title_en** Convert purchase request to purchase order
- **description_id** Membuat Pesanan Pembelian (PO) berstatus DRAF dari PR yang sudah disetujui, dikelompokkan per pemasok. Belum ada jurnal dan belum ada komitmen ke pemasok.
- **riskTier** `WRITE_LOW` · **requiredCapability** `procurement.po.create`
- **reversalOperation** `procurement.rejectPurchaseOrder` (BLOCKED) — see §5

```ts
inputSchema: MutationEnvelope.extend({
  purchaseRequestId: z.string().uuid(),
  supplierAssignments: z.array(z.object({
    purchaseRequestItemId: z.string().uuid(),
    supplierId: z.string().uuid(),
    unitPriceIdr: z.number().int().nonnegative()
      .describe('id: Harga satuan dalam Rupiah penuh, tanpa desimal. | en: Unit price in whole rupiah.'),
  })).min(1).max(50),
  expectedDate: z.string().date().optional(),
})
outputSchema: z.object({
  purchaseOrders: z.array(z.object({
    purchaseOrderId: z.string().uuid(), number: z.string(),
    supplierId: z.string().uuid(), supplierName: z.string(),
    status: z.literal('PO_DRAFT'),
    subtotalIdr: z.number().int(), taxIdr: z.number().int(), netIdr: z.number().int(),
  })),
})
```

- **sideEffects** — `documentsCreated: ['PurchaseOrder(PO_DRAFT)×N', 'PurchaseOrderItem×M']`;
  `documentsMutated: ['PurchaseRequestItem.status → PO_CREATED']`; no GL; no stock.
- **preconditions** — PR is `APPROVED`; every referenced item is not already `PO_CREATED`;
  **every `supplierId` is an existing active supplier**; `Σ netIdr ≤ grant.limits.poDraftMaxValueIdr`.
- **Supplier-placeholder guard (important).** The canonical action will **create a placeholder supplier**
  with `code:'PENDING'` if none is resolved (`:800-810`). The operation makes `supplierId` **mandatory and
  pre-validated** so this branch is unreachable from the agent — an agent must never silently invent a
  vendor. If validation fails: `code:'SUPPLIER_REQUIRED'`, remediation → `procurement.searchSuppliers`.
- **Concurrency** — already correct: guarded item dedupe at `:893-901`
  (`updateMany({where:{id:{in:…}, status:{not:'PO_CREATED'}}})` + `count !== length ⇒ throw` with the
  message `'Konversi PR→PO race detected'`), backed by the partial unique index
  `purchase_order_items_active_pr_item_unique` (migration `20260423120000_add_pr_item_fk_to_po_item:27-29`).
  Mapped to `PR_CONVERSION_RACE`, `retryable:true` after a re-read.
  ⚠️ That index's own comment (migration lines 20-26) admits it does **not** account for PO cancellation —
  and cancellation is currently broken anyway (`:1069`). Recorded in the gate as G-10.

---

### W-6 · `procurement.approvePurchaseOrder` — v1.0.0 · **WRITE_MONEY**

⟶ `lib/actions/procurement.ts:970` `approvePurchaseOrder`

- **title_id** Setujui Pesanan Pembelian · **title_en** Approve purchase order
- **description_id** Menyetujui PO. Ini adalah **komitmen belanja** kepada pemasok dan otomatis membuat draf tagihan pemasok. Wajib persetujuan manusia.
- **description_en** Approves a PO. This is a **spending commitment** to the supplier and automatically creates a draft vendor bill. Human approval required.
- **riskTier** `WRITE_MONEY` · **requiredCapability** `procurement.po.approve`
- **dryRunSupported** `true` · **idempotent** `true` · **reversalOperation** `procurement.rejectPurchaseOrder` (BLOCKED — §5)

```ts
inputSchema: MutationEnvelope.extend({
  purchaseOrderId: z.string().uuid(),
  expectedStatus: z.enum(['PENDING_APPROVAL']),
  expectedNetAmountIdr: z.number().int().nonnegative()
    .describe('id: Nilai PO yang Anda lihat saat membaca. Persetujuan dibatalkan bila nilainya berubah. | ' +
              'en: The PO value you observed. Approval aborts if the value changed.'),
})
outputSchema: z.object({
  purchaseOrderId: z.string().uuid(), number: z.string(),
  status: z.literal('APPROVED'), netAmountIdr: z.number().int(),
  draftBill: z.object({ created: z.boolean(), billNumber: z.string().nullable() }),
})
```

- **sideEffects**
  - `documentsMutated: ['PurchaseOrder.status PENDING_APPROVAL → APPROVED', 'PurchaseOrder.approvedBy']`
  - `documentsCreated: ['PurchaseOrderEvent(APPROVE)', 'Invoice(INV_IN, DRAFT) — out of transaction']`
  - `glAccountsTouched: []` — **deliberately empty and this is correct.** The bill is created at
    `status:'DRAFT'` with no `postJournalEntry` call (`finance-invoices.ts:795-813`). Under accrual basis
    the expense recognises when the **bill is approved**, not when the PO is approved. `CLAUDE.md` Layer 6.
  - `stockMoved: 'none'`
  - `downstreamTriggers: ['recordPendingBillFromPO — OUTSIDE the transaction (procurement.ts:1019)']`
- **preconditions** — PO is `PENDING_APPROVAL`; `netAmount === expectedNetAmountIdr`;
  **SoD hard rule:** `onBehalfOfHuman ≠ PurchaseOrder.createdBy` (the canonical action already enforces
  this at `:983-987` with no override path — the operation preserves that and does **not** add one);
  **value threshold:** always routed to a human approver, and to a *second-level* approver above
  `grant.limits.poApproveMaxValueIdr` (see `AGENT_SAFETY_MODEL.md §4`).
- **Known non-atomicity — declared, not hidden (T-8).** `recordPendingBillFromPO(po)` is called at
  `procurement.ts:1019`, **after** `withPrismaAuth` closed at `:1016`, and **its result is not checked**
  (that function returns `{success:false, error:"Finance Sync Failed"}` on any error at
  `finance-invoices.ts:822`). So the PO can be `APPROVED` with no draft bill.
  **Why the operation is still exposed:** the missing artefact is a `DRAFT` document with **zero GL
  impact**, so the books cannot go out of balance; and `procurement.ts:1306-1313` already contains a
  backfill path. **Required mitigations before exposure:**
  1. The operation checks the return value and reports `severity:'W', code:'BILL_SYNC_PENDING'` in
     `messages` — the agent is told, in Bahasa, that the PO was approved but the draft bill is missing.
  2. The post-write invariant job asserts "every `APPROVED` PO has a non-cancelled `INV_IN`".
  3. `outputSchema.draftBill.created` makes the fact machine-visible rather than buried in prose.
- **Racy bill numbering (T-9).** `finance-invoices.ts:777-784` computes the bill number from
  `invoice.count({where:{number:{startsWith:'BILL-'+po.number}}})`. Two concurrent approvals of POs whose
  numbers share a prefix could collide. `Invoice.number` uniqueness must be confirmed and the numbering
  routed through `getNextDocNumber`. Gate item G-08.

**Worked example — dry run, above threshold**

```jsonc
// ← AgentResult (dryRun: true)
{
  "ok": true, "replayed": false,
  "messages": [
    { "severity":"I", "code":"DRY_RUN_OK",
      "message_id":"Simulasi berhasil. PO PO-202607-0113 akan disetujui.",
      "message_en":"Simulation succeeded. PO PO-202607-0113 would be approved." },
    { "severity":"W", "code":"HUMAN_APPROVAL_REQUIRED",
      "message_id":"Nilai Rp 180.000.000 melebihi batas otomatis Rp 50.000.000. Perlu persetujuan Direktur.",
      "message_en":"Value Rp 180,000,000 exceeds the Rp 50,000,000 auto limit. Director approval required." }
  ],
  "simulation": {
    "journalLines": [],
    "stockDeltas": [],
    "statusChanges": [{ "entity":"PurchaseOrder", "id":"c31a…", "from":"PENDING_APPROVAL", "to":"APPROVED" }],
    "documentsCreated": [{ "type":"Invoice(INV_IN, DRAFT)", "previewNumber":"BILL-PO-202607-0113" }]
  },
  "data": {
    "proposalId": "prop_01J90…",
    "expiresAt": "2026-07-27T10:04:00+07:00",
    "approvalRoute": "HUMAN_SECOND_LEVEL",
    "diff_id": "AKAN DISETUJUI — Pesanan Pembelian PO-202607-0113\n  Pemasok  : PT Sinar Tekstil Jaya\n  DPP      : Rp 162.162.162\n  PPN 11%  : Rp  17.837.838\n  Total    : Rp 180.000.000\n  Status   : MENUNGGU PERSETUJUAN → DISETUJUI\n  Jurnal   : TIDAK ADA. Beban diakui saat tagihan pemasok disetujui, bukan saat PO disetujui.\n  Efek lain: draf tagihan BILL-PO-202607-0113 akan dibuat (status DRAF, tanpa jurnal).\n\n  ⚠ Anda menyetujui komitmen belanja Rp 180.000.000 kepada pemasok.",
    "diff_en": "WILL APPROVE — Purchase Order PO-202607-0113 …"
  }
}
```

The Bahasa diff states plainly that **no journal entry is posted** — the single most common source of
"why isn't this in my Laba Rugi?" confusion (`CLAUDE.md`, Known Gap #1). The agent is not left to explain
it; the proposal card does.

---

### W-11 · `procurement.createGoodsReceipt` — v1.0.0

⟶ `lib/actions/grn.ts:262` `createGRN`

- **title_id** Buat Surat Penerimaan Barang (Draf) · **title_en** Create goods receipt note (draft)
- **description_id** Mencatat kedatangan barang sebagai draf. Stok **belum** bertambah dan jurnal **belum** dibuat — itu terjadi saat penerimaan dikonfirmasi.
- **riskTier** `WRITE_LOW` · **requiredCapability** `procurement.grn.create`
- **reversalOperation** `procurement.rejectGoodsReceipt`

```ts
inputSchema: MutationEnvelope.extend({
  purchaseOrderId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  receivedDate: z.string().date()
    .describe('id: Tanggal barang benar-benar diterima. | en: Date the goods physically arrived.'),
  notes_id: z.string().max(500).optional(),
  lines: z.array(z.object({
    poItemId: z.string().uuid(),
    quantityReceived: z.number().positive().describe('id: Jumlah fisik yang datang. | en: Physical quantity that arrived.'),
    quantityAccepted: z.number().nonnegative().describe('id: Jumlah lolos inspeksi. | en: Quantity passing inspection.'),
    quantityRejected: z.number().nonnegative().default(0).describe('id: Jumlah ditolak. | en: Quantity rejected.'),
    inspectionNotes_id: z.string().max(300).optional(),
  })).min(1).max(50),
})
outputSchema: z.object({
  goodsReceiptId: z.string().uuid(), number: z.string(),   // "SJM-202607-0031"
  status: z.literal('DRAFT'), lineCount: z.number().int(),
  totalAcceptedValueIdr: z.number().int(),
})
```

- **preconditions**
  1. PO status ∈ `{APPROVED, ORDERED, VENDOR_CONFIRMED, SHIPPED, PARTIAL_RECEIVED}` — mirrors `grn.ts:318`.
  2. `quantityAccepted + quantityRejected === quantityReceived` (the canonical action does **not** check
     this — `grn.ts:354-363` defaults `quantityAccepted` to `quantityReceived` and `quantityRejected` to
     `0` independently, so an agent could submit 100/60/0 and silently lose 40 units).
  3. `quantityReceived ≤ remaining` per line — enforced canonically at `grn.ts:332-341`.
  4. `receivedDate` falls in an **open fiscal period**.
- **Auto-transition side effect, declared.** If the PO is `APPROVED`, the canonical action silently
  transitions it to `ORDERED` and writes an `AUTO_ORDERED_VIA_GRN` event (`grn.ts:298-316`). The
  `simulation.statusChanges` must show this, or the human approves a receipt and gets an unexplained PO
  status change.
- **Idempotency is *not* structural here (traced in ARCHITECTURE §3.3).** The only protection against a
  duplicate GRN is the remaining-quantity check at `:332-341`, which blocks a retried **full** receipt
  (remaining becomes 0) but **allows** a retried **partial** receipt. `AgentOperationRecord` is mandatory
  for this operation — it is the single control that makes the retry safe. Gate item G-01.

---

### W-12 · `procurement.receiveGoods` — v1.0.0 · **WRITE_MONEY** · ★ the traced operation ★

⟶ `lib/actions/grn.ts:382` `acceptGRN`

- **title_id** Konfirmasi Penerimaan Barang · **title_en** Confirm goods receipt
- **description_id** Mengonfirmasi surat penerimaan barang. **Stok bertambah dan jurnal dibuat**: Debit Persediaan (1300), Kredit GR/IR Clearing (2150). Tidak bisa dibatalkan — koreksi harus lewat retur pembelian.
- **description_en** Confirms a goods receipt note. **Stock increases and a journal entry is posted**: DR Inventory (1300), CR GR/IR Clearing (2150). Cannot be undone — corrections go through a purchase return.
- **riskTier** `WRITE_MONEY` · **requiredCapability** `procurement.grn.accept`
- **dryRunSupported** `true` · **idempotent** `true` (via `AgentOperationRecord`) · **reversalOperation** `procurement.reversePurchaseReceipt` (**BLOCKED** — see §5, and see the exposure note below)

```ts
inputSchema: MutationEnvelope.extend({
  goodsReceiptId: z.string().uuid(),
  expectedStatus: z.literal('DRAFT'),
  expectedTotalAcceptedValueIdr: z.number().int().nonnegative()
    .describe('id: Nilai yang Anda lihat saat membaca GRN. Dibatalkan bila berubah. | ' +
              'en: The value you observed. Aborts if it changed.'),
  sodOverrideReason_id: z.string().min(10).max(500).optional()
    .describe('id: Wajib bila penyetuju PO ini juga yang menerima barang. Min 10 karakter, Bahasa Indonesia. | ' +
              'en: Required when the PO approver is also receiving. Min 10 chars, in Bahasa.'),
})

outputSchema: z.object({
  goodsReceiptId: z.string().uuid(), number: z.string(),
  status: z.literal('ACCEPTED'),
  stockUpdates: z.array(z.object({
    productId: z.string().uuid(), productCode: z.string(), productName: z.string(),
    warehouseId: z.string().uuid(), quantityAdded: z.number(), unit: z.string(),
  })),
  journalEntries: z.array(z.object({
    reference: z.string(),                       // "JV-INV-20260727-000412"
    lines: z.array(z.object({
      accountCode: z.string(), accountName: z.string(),
      debitIdr: z.number().int(), creditIdr: z.number().int(),
    })),
  })),
  purchaseOrderStatus: z.object({
    from: z.string(), to: z.string(),
    synced: z.boolean().describe('id: false bila transisi PO gagal (penerimaan tetap sah). | ' +
                                 'en: false if the PO transition failed (the receipt is still valid).'),
  }),
})
```

**sideEffects**

```jsonc
{
  "documentsMutated": [
    "GoodsReceivedNote.status DRAFT → ACCEPTED (grn.ts:448-458)",
    "PurchaseOrderItem.receivedQty += quantityAccepted (grn.ts:473-483)",
    "PurchaseOrder.status → PARTIAL_RECEIVED | RECEIVED | COMPLETED (grn.ts:606-630, best-effort)"
  ],
  "documentsCreated": [
    "InventoryTransaction(PO_RECEIVE) × accepted lines (grn.ts:499-511)",
    "JournalEntry(POSTED) × accepted lines (inventory-gl.ts:164-175)",
    "PurchaseOrderEvent(SOD_OVERRIDE | RECEIVE_FULL | RECEIVE_PARTIAL | AUTO_COMPLETE)"
  ],
  "glAccountsTouched": [
    { "code": "1300", "name": "Persediaan (Inventory Asset)", "direction": "DR" },
    { "code": "2150", "name": "GR/IR Clearing",               "direction": "CR" }
  ],
  "stockMoved": "increase",
  "downstreamTriggers": [
    "recalculateVendorRating — unawaited, post-commit, singleton client (grn.ts:657-659) → must become a jobId (T-4)",
    "revalidatePath × 9 (grn.ts:662-670)"
  ]
}
```

Account codes resolve from `SYS_ACCOUNTS.INVENTORY_ASSET` / `SYS_ACCOUNTS.GR_IR_CLEARING`
(`inventory-gl.ts:56-62`) — **never** string literals. Mapping at `inventory-gl.ts:132-134`.

**preconditions** (evaluated inside the transaction, before any write)

1. `AgentOperationRecord` insert on `(principal, 'procurement.receiveGoods', idempotencyKey)` succeeds,
   or the stored prior result is replayed. **[G-01]**
2. `assertPeriodOpen(tx, grn.receivedDate)` — **currently missing entirely**; `grn.ts` never calls it and
   `postJournalEntry` skips it whenever a `txClient` is passed (`finance-gl.ts:332-338`). **[G-06]**
3. GRN status is `DRAFT` — enforced canonically and atomically at `grn.ts:448-458`.
4. `stateFingerprint` matches (GRN `updatedAt`, every line's `quantityAccepted`/`unitCost`, PO `status`).
5. SoD: if a `PurchaseOrderEvent(action:'APPROVE', changedBy: onBehalfOfHuman)` exists
   (`grn.ts:409-416`), `sodOverrideReason_id` ≥ 10 chars is required and the operation is forced to
   human approval **regardless of value**.
6. `Σ(quantityAccepted × unitCost) === expectedTotalAcceptedValueIdr`.
7. GL accounts `1300` and `2150` exist (`ensureSystemAccounts()` has run).
8. Every accepted quantity is an integer **or** `InventoryTransaction.quantity` has been migrated to
   `Decimal` — see G-11 / T-7. A fractional fabric receipt currently cannot be written to the ledger.

**Exposure decision — honest statement of the gap.** `reversalOperation` points at
`procurement.reversePurchaseReceipt`, which is **BLOCKED** (§5). Rule 5 of the SAP spine says corrections
must be reversals, and W-12 posts to the GL. **Therefore `procurement.receiveGoods` is exposed in Stage 1
only if G-10 ships in the same release as G-01.** If the reversal is not available, an agent-driven
receipt has no agent-driven correction — the human must correct it manually, which is acceptable for a
supervised shadow/propose stage but is **not** acceptable for thresholded autonomy. This dependency is
recorded in `AGENT_ROLLOUT_PLAN.md` as a Stage-3 entry criterion.

**Error mapping — every canonical throw gets a stable code**

| Canonical behaviour | `path:line` | code | severity | retryable | remediation_id |
|---|---|---|---|---|---|
| replay of a completed key | new | `REPLAYED` | S | – | – (original result returned) |
| `'GRN sudah diproses atau tidak ditemukan.'` | `grn.ts:457` | `GRN_ALREADY_PROCESSED` | E | false | "Baca ulang GRN dengan procurement.getGoodsReceipt untuk melihat status terkini." |
| SoD soft-block return | `grn.ts:421-427` | `SOD_REASON_REQUIRED` | E | false | "Anda menyetujui PO ini. Isi sodOverrideReason_id minimal 10 karakter, lalu ajukan ulang." |
| `'Jumlah penerimaan melebihi pesanan…'` | `grn.ts:486-490` | `OVER_RECEIPT` | E | **true** | "GRN lain baru saja diterima. Baca ulang sisa PO, lalu buat GRN baru untuk sisa yang benar." |
| GL post failed | `inventory-gl.ts:177-180` | `GL_POSTING_FAILED` | A | false | "Akun GL 1300/2150 belum ada. Jalankan ensureSystemAccounts. Tidak ada perubahan yang tersimpan." |
| unbalanced lines | `finance-gl.ts:328` | `JOURNAL_UNBALANCED` | A | false | internal — page the on-call, trip the kill switch |
| period closed (after G-06) | new | `PERIOD_CLOSED` | E | false | "Periode fiskal sudah ditutup. Minta akuntan membuka periode atau catat di periode berjalan." |
| `P2002` on `stock_levels_warehouse_no_location_unique` | migration `20260423140000` | `STOCK_ROW_CONFLICT` | W | **true**, 500 ms | "Baris stok dibuat bersamaan oleh proses lain. Coba lagi dengan kunci idempotensi yang SAMA." |
| PO transition failed (non-blocking) | `grn.ts:632-648` | `PO_STATUS_OUT_OF_SYNC` | **W** | false | "Barang sudah diterima dan jurnal sudah dibuat, tetapi status PO belum diperbarui. Laporkan ke admin." |

The last row matters: the canonical action deliberately does **not** roll back when the PO transition
fails (`grn.ts:632-636`). Without an explicit `W` message the agent would report unqualified success and
the PO would silently sit in the wrong status.

**Worked example 1 — dry run**

```jsonc
// → procurement.receiveGoods { dryRun: true, goodsReceiptId: "9a4e…", expectedStatus: "DRAFT",
//                              expectedTotalAcceptedValueIdr: 22050000,
//                              idempotencyKey: "3c9b8e10-…" }
{
  "ok": true, "replayed": false,
  "correlationId": "ep_2026-07-27_1042_b7d2",
  "operationId": "procurement.receiveGoods", "operationVersion": "1.0.0",
  "messages": [
    { "severity":"I", "code":"DRY_RUN_OK",
      "message_id":"Simulasi berhasil. Belum ada yang tersimpan.",
      "message_en":"Simulation succeeded. Nothing was saved." },
    { "severity":"W", "code":"HUMAN_APPROVAL_REQUIRED",
      "message_id":"Operasi ini menambah stok dan membuat jurnal. Perlu konfirmasi manusia.",
      "message_en":"This operation increases stock and posts a journal entry. Human confirmation required." }
  ],
  "retryable": false,
  "simulation": {
    "journalLines": [
      { "accountCode":"1300", "accountName":"Persediaan", "debit":22050000, "credit":0 },
      { "accountCode":"2150", "accountName":"GR/IR Clearing", "debit":0, "credit":22050000 }
    ],
    "stockDeltas": [
      { "productId":"b2f1…", "productName":"Kain Katun 30s", "warehouseId":"7e01…", "delta":490, "unit":"meter" }
    ],
    "statusChanges": [
      { "entity":"GoodsReceivedNote", "id":"9a4e…", "from":"DRAFT", "to":"ACCEPTED" },
      { "entity":"PurchaseOrder", "id":"c31a…", "from":"ORDERED", "to":"PARTIAL_RECEIVED" }
    ],
    "documentsCreated": [
      { "type":"InventoryTransaction(PO_RECEIVE)", "previewNumber":"—" },
      { "type":"JournalEntry(POSTED)", "previewNumber":"JV-INV-20260727-<berikutnya>" }
    ]
  },
  "data": {
    "proposalId": "prop_01J91K…",
    "expiresAt": "2026-07-27T10:57:00+07:00",
    "stateFingerprint": "sha256:1f0c…",
    "approvalRoute": "HUMAN_FIRST_LEVEL",
    "diff_id":
      "AKAN DIKONFIRMASI — Penerimaan Barang SJM-202607-0031\n  PO       : PO-202607-0113 (PT Sinar Tekstil Jaya)\n  Gudang   : Gudang Bahan Baku\n\n  BARANG MASUK\n    Kain Katun 30s (KAT-30S)  490 meter @ Rp 45.000  = Rp 22.050.000\n    (dari 500 meter datang, 10 meter ditolak: noda pada gulungan 7)\n\n  JURNAL YANG AKAN DIBUAT\n    Debit  1300 Persediaan          Rp 22.050.000\n    Kredit 2150 GR/IR Clearing                     Rp 22.050.000\n\n  PERUBAHAN STATUS\n    Penerimaan : DRAF → DITERIMA\n    PO         : ORDERED → DITERIMA SEBAGIAN\n\n  ⚠ Setelah dikonfirmasi, stok dan jurnal TIDAK BISA dibatalkan. Koreksi harus melalui retur pembelian.",
    "diff_en": "WILL CONFIRM — Goods Receipt SJM-202607-0031 …"
  }
}
```

**Worked example 2 — the retry that proves the idempotency design**

```jsonc
// Turn 1: agent.confirmProposal { proposalId: "prop_01J91K…" }
//   → server commits at t=19.8s; MCP client deadline fires at t=20.0s; agent sees a transport timeout.
// Turn 2: agent retries with the SAME idempotencyKey "3c9b8e10-…"
{
  "ok": true,
  "replayed": true,                                  // ← the whole point
  "correlationId": "ep_2026-07-27_1042_b7d2",
  "operationId": "procurement.receiveGoods",
  "idempotencyKey": "3c9b8e10-…",
  "messages": [{
    "severity": "S", "code": "REPLAYED",
    "message_id": "Penerimaan SJM-202607-0031 sudah diproses sebelumnya pada 10:44:07. Ini hasil yang sama, tidak ada perubahan baru.",
    "message_en": "Receipt SJM-202607-0031 was already processed at 10:44:07. This is the same result; nothing new was written."
  }],
  "retryable": false,
  "data": {
    "goodsReceiptId": "9a4e…", "number": "SJM-202607-0031", "status": "ACCEPTED",
    "stockUpdates": [{ "productCode":"KAT-30S", "quantityAdded":490, "unit":"meter", "…":"…" }],
    "journalEntries": [{ "reference":"JV-INV-20260727-000412",
      "lines":[{"accountCode":"1300","debitIdr":22050000,"creditIdr":0},
               {"accountCode":"2150","debitIdr":0,"creditIdr":22050000}] }],
    "purchaseOrderStatus": { "from":"ORDERED", "to":"PARTIAL_RECEIVED", "synced": true }
  }
}
```

**Without `AgentOperationRecord`, turn 2 returns**
`{"ok":false,"messages":[{"severity":"E","message_id":"GRN sudah diproses atau tidak ditemukan. Refresh halaman."}]}`
— a *failure* for an operation that *succeeded* (`grn.ts:456-458`), which is exactly the state that leads
a well-behaved agent to create a second GRN. This one example is the whole argument for gate item G-01.

**Worked example 3 — proposal executed against drifted state**

```jsonc
// A colleague accepted a different GRN for the same PO between propose and confirm.
{
  "ok": false, "replayed": false,
  "messages": [{
    "severity": "E", "code": "PROPOSAL_STALE",
    "message_id": "Data berubah sejak simulasi dibuat: sisa PO untuk Kain Katun 30s sekarang 0 meter (sebelumnya 500). Tidak ada yang ditulis.",
    "message_en": "State changed since the simulation: remaining PO quantity for Kain Katun 30s is now 0 meter (was 500). Nothing was written."
  }],
  "retryable": false,
  "remediation": {
    "message_id": "Baca ulang dengan procurement.listPurchaseOrdersAwaitingReceipt, lalu ajukan simulasi baru dengan kunci idempotensi BARU.",
    "message_en": "Re-read with procurement.listPurchaseOrdersAwaitingReceipt, then propose again with a NEW idempotency key.",
    "suggestedOperation": "procurement.listPurchaseOrdersAwaitingReceipt"
  }
}
```

Note the remediation says **new** key here (the intent has changed) versus **same** key on a transient
failure. Getting that distinction right in the remediation text is what stops an agent from either
double-posting or dead-locking itself.

---

### W-13 · `procurement.rejectGoodsReceipt` — v1.0.0

⟶ `lib/actions/grn.ts:684` `rejectGRN`

- **title_id** Tolak Penerimaan Barang · **title_en** Reject goods receipt
- **description_id** Menolak draf penerimaan barang (mis. barang tidak sesuai pesanan). Stok tidak berubah dan tidak ada jurnal. Hanya bisa untuk draf.
- **riskTier** `WRITE_LOW` · **requiredCapability** `procurement.grn.reject`
- **reversalOperation** `null` — this **is** the corrective operation for W-11.

```ts
inputSchema: MutationEnvelope.extend({
  goodsReceiptId: z.string().uuid(),
  expectedStatus: z.literal('DRAFT'),
  rejectionReason_id: z.string().min(10).max(500)
    .describe('id: Alasan penolakan dalam Bahasa Indonesia (min 10 karakter). | en: Rejection reason in Bahasa (min 10 chars).'),
})
outputSchema: z.object({ goodsReceiptId: z.string().uuid(), number: z.string(), status: z.literal('REJECTED') })
```

- Already correct canonically: guarded `updateMany({where:{id, status:'DRAFT'}})` at `:693-702` with an
  explicit diagnosis branch at `:703-713` that distinguishes "already accepted" from "already rejected"
  from "not found" — mapped to `GRN_ALREADY_ACCEPTED`, `GRN_ALREADY_REJECTED`, `GRN_NOT_FOUND`.
- **sideEffects** — `documentsMutated: ['GoodsReceivedNote.status DRAFT → REJECTED']`; no GL; no stock.

---

## 5. Blocked operations — full descriptors withheld until the gate clears

Each is designed and reserved, but the MCP server emits **no tool** for it. Listing them prevents a future
session from "helpfully" adding a raw-Prisma version.

| Operation | Bound action | Blocking defect (verified) | Gate item |
|---|---|---|---|
| `procurement.rejectPurchaseRequest` | `procurement.ts:710` | Unguarded `update({where:{id}})` at `:742`; only a read-then-check TOCTOU at `:730-731`. Asymmetric with the *approve* path, which **is** guarded at `:618-627` — so a concurrent approve+reject both pass and last-write-wins. | G-03 |
| `procurement.submitOrderForApproval` | `procurement.ts:933` | Unguarded `update` at `:945`. The only PO lifecycle transition missing the guard that `:991`, `:1167`, `:1206`, `:1245` all have. | G-03 |
| `procurement.rejectPurchaseOrder` | `procurement.ts:1030` | Unguarded `update` at `:1042`. | G-03 |
| `procurement.reversePurchaseReceipt` | `procurement.ts:2530` `createPurchaseReturn` | `getAuthzUser()` at `:2531` but **no `assertRole`** — any authenticated user can issue a debit note, decrement stock, and post to AP/Inventory/PPN. The stock decrement is exemplary (`gte`-guarded `updateMany` at `:2628-2642`), but the sibling `purchaseOrderItem.update({returnedQty:{increment}})` at `:2648-2651` is **unguarded**, and the over-return check at `:2617-2620` is read-then-write — two concurrent returns can push `returnedQty` past `receivedQty`. Also calls `ensureSystemAccounts()` at `:2657` **with no tx client while a tx is open**. | G-03, G-10 |

**`procurement.reversePurchaseReceipt` is the highest-priority unblock in the slice.** It is the Storno
for `receiveGoods` — `RETURN_OUT`: `DR 2150 GR/IR Clearing / CR 1300 Persediaan` (`inventory-gl.ts:154-156`).
Without it, the catalog has a money-moving operation with no correction path, which violates SAP spine
rule *Storno* and blocks Stage 3 entirely.

---

## 6. Capability manifest (`agent.describeCapabilities`) — the `$metadata` equivalent

Generated **from the descriptors**, so documentation and behaviour cannot drift.

```ts
inputSchema: z.object({
  domain: z.enum(['procurement','inventory','agent']).optional()
    .describe('id: Batasi ke satu domain. | en: Restrict to one domain.'),
  includeSchemas: z.boolean().default(false)
    .describe('id: Sertakan JSON Schema lengkap (payload besar). | en: Include full JSON Schema (large payload).'),
})
```

Returns, per operation: `id`, `version`, bilingual title/description, `riskTier`, `requiredCapability`,
`permittedByCurrentGrant` (boolean — resolved against *this* session's grant), `remainingLimitIdr`,
`dryRunSupported`, `idempotent`, `reversalOperation`, a one-line `sideEffectSummary_id`, and (optionally)
the JSON Schema. Plus session-level facts: `toolBudgetUsed/Max`, `concurrencyUsed/Max`,
`killSwitchActive`, `grantExpiresAt`, `tenancy: 'single'`.

Rationale: the agent discovers what it may do **at runtime**, from the server. Nothing is baked into a
system prompt, so a capability revocation takes effect on the agent's next discovery call rather than
requiring a redeploy — and an agent that believes it has a capability it does not have finds out from the
manifest instead of from a denied write.

---

## 7. Catalog-level self-check

| Assertion | Status |
|---|---|
| Every non-READ operation has `dryRunSupported: true` | ✅ 14/14 |
| Every non-READ operation has `idempotent: true` (via `AgentOperationRecord`) | ✅ 14/14 — contingent on G-01 |
| Every `WRITE_MONEY` operation has a threshold policy | ✅ W-6, W-12 → `AGENT_SAFETY_MODEL.md §4` |
| Every `WRITE_MONEY` / `IRREVERSIBLE` operation names a `reversalOperation` | ⚠️ W-12 names `reversePurchaseReceipt`, which is **BLOCKED** → Stage-3 entry criterion |
| No delete operations | ✅ 0 |
| No operation binds `lib/actions/finance.ts` | ✅ 0 |
| No operation uses raw Prisma | ✅ — 4 missing reads become canonical additions (G-09) |
| No exposed operation wraps a non-atomic or unguarded action | ✅ — 4 moved to BLOCKED (§5) |
| Every operation ≤ 8 top-level input fields | ✅ max is W-1 at 8 (3 envelope + 5) |
| Stage-1 tool count ≤ 30 | ✅ 23 |
| Every human-facing string has `message_id` first | ✅ |
| Every GL account referenced via `SYS_ACCOUNTS.*`, never a literal | ✅ (`inventory-gl.ts:56-62`) |

# Debit & Credit Notes System Overhaul

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete, spec-compliant Debit Note / Credit Note system with line items, settlement tracking, PPN handling, and proper journal entries — replacing the current Invoice-table hack.

**Architecture:** Dedicated Prisma models (`DebitCreditNote`, `DebitCreditNoteItem`, `DebitCreditNoteSettlement`) with server actions for CRUD + journal posting. Tabbed UI page at `/finance/credit-notes` with separate views for Sales CN, Sales DN, Purchase DN, Purchase CN. Auto-select GL accounts based on document type.

**Tech Stack:** Prisma 6.x, Next.js server actions, TanStack Query, shadcn/ui, neo-brutalist styling

**Reference Spec:** `docs/erp_debit_credit_notes.json` (1416 lines)

---

## Current State (What Exists)

1. **Prisma `CreditNote` model** — exists but UNUSED (customer-only, no line items)
2. **Invoice-table hack** — CN/DN stored as Invoice records with negative `totalAmount`
3. **Server actions** in `lib/actions/finance.ts`:
   - `createCreditNote()` — creates Invoice + JournalEntry, flat amount
   - `createDebitNote()` — creates Invoice + JournalEntry, flat amount
   - `getCreditDebitNotes()` — queries JournalEntry by `[CREDIT_NOTE]`/`[DEBIT_NOTE]` prefix
   - `getCreditDebitNoteAccounts()` — fetches COA accounts for dropdowns
4. **Page** at `app/finance/credit-notes/page.tsx` — combined CN/DN with inline form
5. **Tab components**: `nota-kredit-tab.tsx`, `nota-debit-tab.tsx` — separate create dialogs
6. **Hook**: `hooks/use-credit-debit-notes.ts` — TanStack Query wrapper

## Gap Analysis

| Feature | Spec | Current | Gap |
|---------|------|---------|-----|
| Dedicated DB tables | 3 tables (header, items, settlements) | Uses Invoice table | **MAJOR** |
| Document types | 4 (Sales CN/DN, Purchase CN/DN) | 2 (CN, DN) | **MAJOR** |
| Line items | Per-product qty, price, tax | Flat amount only | **MAJOR** |
| Reason codes | 14 codes | 5-6 hardcoded | Medium |
| Settlement tracking | Settlement log with partial apply | Optional invoiceId link | **MAJOR** |
| Approval workflow | DRAFT→APPROVED→POSTED | Auto-posts immediately | Medium |
| PPN handling | Separate PPN lines, Nota Retur | Checkbox, not in journal | Medium |
| Journal entries | 12 scenario-specific templates | 2 basic templates | Medium |
| Reports | 6 report types | None | Low priority |
| Auto-detection | 8 rules | None | Low priority (future) |
| Numbering | CN-S, CN-P, DN-S, DN-P, NR | CN-, DN- | Small |

## Pragmatic Scope (SME Focus)

Per CLAUDE.md: "Industry standard as baseline, simplify from there — strip away enterprise bloat that SMEs don't need."

**In scope (this plan):**
- Proper DB models with line items
- 4 document types with correct journal entries
- All 14 reason codes from spec
- Settlement tracking (apply CN/DN to invoices)
- PPN handling in journal entries
- Redesigned UI with tabs per type
- Link to original invoice/bill

**Deferred (future):**
- Multi-level approval workflow (SMEs rarely need 4-level approval)
- Auto-detection rules
- 6 dedicated reports (existing journal/GL reports cover this)
- PDF generation for CN/DN
- Nota Retur e-Faktur integration

---

## Task 1: Prisma Schema — New Models

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add DebitCreditNote model and related enums**

Replace the unused `CreditNote` model with:

```prisma
// ================================
// Debit & Credit Notes
// ================================

enum DCNoteType {
  SALES_CN      // Nota Kredit Penjualan (seller issues to buyer — reduces AR)
  SALES_DN      // Nota Debit Penjualan (buyer requests from seller — claim)
  PURCHASE_DN   // Nota Debit Pembelian (buyer issues to seller — reduces AP)
  PURCHASE_CN   // Nota Kredit Pembelian (seller issues to buyer — reduces AP)
}

enum DCNoteStatus {
  DRAFT
  POSTED
  APPLIED      // Fully settled against invoice(s)
  PARTIAL      // Partially settled
  VOID
  CANCELLED
}

enum DCNoteReasonCode {
  RET_DEFECT       // Barang cacat/rusak
  RET_WRONG        // Barang tidak sesuai pesanan
  RET_QUALITY      // Kualitas tidak standar
  RET_EXCESS       // Kelebihan kirim
  RET_EXPIRED      // Barang kadaluarsa
  ADJ_OVERCHARGE   // Kelebihan tagih
  ADJ_DISCOUNT     // Diskon belum dipotong
  ADJ_UNDERCHARGE  // Kekurangan tagih
  ADJ_ADDCHARGE    // Biaya tambahan
  SVC_CANCEL       // Pembatalan jasa
  SVC_SHORT        // Jasa tidak lengkap
  ORD_CANCEL       // Pembatalan pesanan
  ADJ_PENALTY      // Penalti/denda
  ADJ_REBATE       // Potongan volume
  ADJ_GOODWILL     // Goodwill adjustment
}

model DebitCreditNote {
  id            String         @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  number        String         @unique  // CN-S-00001, DN-P-00001, etc.
  type          DCNoteType
  status        DCNoteStatus   @default(DRAFT)
  reasonCode    DCNoteReasonCode

  // Party (one of these will be set)
  customerId    String?        @db.Uuid
  supplierId    String?        @db.Uuid

  // Reference to original document
  originalInvoiceId  String?   @db.Uuid
  originalReference  String?   // Free-text ref (SO/PO number)

  // Amounts
  subtotal      Decimal        @db.Decimal(15, 2)
  ppnAmount     Decimal        @default(0) @db.Decimal(15, 2)
  totalAmount   Decimal        @db.Decimal(15, 2)
  settledAmount Decimal        @default(0) @db.Decimal(15, 2)  // How much has been applied

  // Dates
  issueDate     DateTime       @default(now())
  postingDate   DateTime?

  // Metadata
  notes         String?
  description   String?        // Reason detail

  // Journal
  journalEntryId String?       @db.Uuid

  // Relations
  customer      Customer?      @relation(fields: [customerId], references: [id])
  supplier      Supplier?      @relation(fields: [supplierId], references: [id])
  originalInvoice Invoice?     @relation("DCNoteOriginalInvoice", fields: [originalInvoiceId], references: [id])
  journalEntry  JournalEntry?  @relation(fields: [journalEntryId], references: [id])
  items         DebitCreditNoteItem[]
  settlements   DebitCreditNoteSettlement[]

  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  @@index([type])
  @@index([status])
  @@index([customerId])
  @@index([supplierId])
  @@map("debit_credit_notes")
}

model DebitCreditNoteItem {
  id            String         @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  noteId        String         @db.Uuid

  // Product reference (optional — some items are service/adjustment)
  productId     String?        @db.Uuid
  description   String         // Item description

  // Quantities & pricing
  quantity      Decimal        @db.Decimal(15, 2)
  unitPrice     Decimal        @db.Decimal(15, 2)
  amount        Decimal        @db.Decimal(15, 2)   // qty * unitPrice
  ppnAmount     Decimal        @default(0) @db.Decimal(15, 2)
  totalAmount   Decimal        @db.Decimal(15, 2)   // amount + ppnAmount

  note          DebitCreditNote @relation(fields: [noteId], references: [id], onDelete: Cascade)
  product       Product?       @relation(fields: [productId], references: [id])

  createdAt     DateTime       @default(now())

  @@map("debit_credit_note_items")
}

model DebitCreditNoteSettlement {
  id            String         @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  noteId        String         @db.Uuid
  invoiceId     String         @db.Uuid

  amount        Decimal        @db.Decimal(15, 2)  // Amount applied to this invoice

  note          DebitCreditNote @relation(fields: [noteId], references: [id], onDelete: Cascade)
  invoice       Invoice        @relation("DCNoteSettlements", fields: [invoiceId], references: [id])

  createdAt     DateTime       @default(now())

  @@map("debit_credit_note_settlements")
}
```

**Step 2: Add reverse relations to existing models**

Add to `Customer` model: `debitCreditNotes DebitCreditNote[]`
Add to `Supplier` model: `debitCreditNotes DebitCreditNote[]`
Add to `Invoice` model: `dcNoteOrigins DebitCreditNote[] @relation("DCNoteOriginalInvoice")` and `dcNoteSettlements DebitCreditNoteSettlement[] @relation("DCNoteSettlements")`
Add to `JournalEntry` model: `debitCreditNote DebitCreditNote?`
Add to `Product` model: `debitCreditNoteItems DebitCreditNoteItem[]`

**Step 3: Remove old unused CreditNote model and its enums**

Delete the `CreditNote` model, `CreditNoteStatus` enum, and `CreditReason` enum.
Remove `creditNotes CreditNote[]` from `Customer` model.

**Step 4: Run migration**

```bash
npx prisma migrate dev --name add_debit_credit_notes
npx prisma generate
```

**Step 5: Verify**

```bash
npx tsc --noEmit  # Fix any TS errors from removed CreditNote references
```

---

## Task 2: Server Actions — CRUD + Journal Posting

**Files:**
- Create: `lib/actions/finance-dcnotes.ts`
- Modify: `lib/query-keys.ts` (add dcNotes key factory)

**Step 1: Create `lib/actions/finance-dcnotes.ts`**

Implement these server actions:

```typescript
"use server"

// Helper constants (reason labels, account mapping, number prefixes)

// --- QUERIES ---

// getDCNotes(filters?: { type?, status?, customerId?, supplierId? })
//   - Fetch all notes with items, settlements, customer/supplier name
//   - Include original invoice number
//   - Order by issueDate desc

// getDCNoteById(id: string)
//   - Full note with items, settlements, journal entry

// getDCNoteFormData()
//   - Fetch customers, suppliers, products, GL accounts for form dropdowns
//   - Include invoices (for linking) filtered by customer/supplier

// getCustomerInvoices(customerId: string)
//   - Invoices with balanceDue > 0 for settlement

// getSupplierBills(supplierId: string)
//   - Bills (INV_IN) with balanceDue > 0 for settlement

// --- MUTATIONS ---

// createDCNote(input: CreateDCNoteInput)
//   - Validate required fields
//   - Generate number: prefix based on type (CN-S, CN-P, DN-S, DN-P)
//   - Create note + items in transaction
//   - Return { success, id, number }

// postDCNote(id: string)
//   - Validate note is DRAFT
//   - Create journal entry based on type:
//     * SALES_CN: DR Revenue + DR PPN Keluaran, CR Piutang
//     * SALES_DN: DR Piutang, CR Revenue (additional charge to customer)
//     * PURCHASE_DN: DR Hutang, CR HPP/Expense + CR PPN Masukan
//     * PURCHASE_CN: DR HPP/Expense, CR Hutang (supplier overcharged)
//   - Update GL balances
//   - Set status = POSTED, postingDate = now
//   - Return { success }

// settleDCNote(noteId: string, settlements: { invoiceId: string, amount: number }[])
//   - Validate note is POSTED
//   - Validate total settlements <= remaining unsettled
//   - Create settlement records
//   - Update note.settledAmount
//   - Update each invoice.balanceDue
//   - Update note status to APPLIED (if fully settled) or PARTIAL
//   - Return { success }

// voidDCNote(id: string)
//   - Validate note is DRAFT or POSTED
//   - If POSTED: reverse journal entry, reverse GL balances
//   - If has settlements: reverse invoice balanceDue updates
//   - Set status = VOID
//   - Return { success }
```

**Step 2: Add query keys to `lib/query-keys.ts`**

```typescript
dcNotes: {
  all: ["dcNotes"] as const,
  list: (filters?: any) => ["dcNotes", "list", filters] as const,
  detail: (id: string) => ["dcNotes", "detail", id] as const,
  formData: () => ["dcNotes", "formData"] as const,
},
```

**Step 3: Verify**

```bash
npx tsc --noEmit
```

---

## Task 3: TanStack Query Hook

**Files:**
- Modify: `hooks/use-credit-debit-notes.ts` (rewrite)

**Step 1: Rewrite hook to use new server actions**

```typescript
"use client"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getDCNotes, getDCNoteFormData } from "@/lib/actions/finance-dcnotes"

export function useDCNotes(filters?: { type?: string; status?: string }) {
    return useQuery({
        queryKey: queryKeys.dcNotes.list(filters),
        queryFn: () => getDCNotes(filters),
    })
}

export function useDCNoteFormData() {
    return useQuery({
        queryKey: queryKeys.dcNotes.formData(),
        queryFn: () => getDCNoteFormData(),
    })
}
```

---

## Task 4: Page Redesign — Tabbed Layout

**Files:**
- Modify: `app/finance/credit-notes/page.tsx` (complete rewrite)

**Step 1: Rewrite page with tabs**

Layout:
- Header: "Nota Kredit & Debit" with "Buat Nota" button
- KPI strip: Total CN, Total DN, Pending, Settled
- Tab bar: "Semua" | "Nota Kredit (CN)" | "Nota Debit (DN)" | with sub-filters for Sales/Purchase
- Table with columns: No, Tipe, Tanggal, Pihak, Alasan, Jumlah, PPN, Total, Status, Aksi
- Status badges: DRAFT (gray), POSTED (blue), PARTIAL (amber), APPLIED (green), VOID (red)
- Row click → detail sheet/panel

Use the `useDCNotes()` hook with filter state.

---

## Task 5: Create Note Dialog

**Files:**
- Create: `components/finance/create-dcnote-dialog.tsx`

**Step 1: Build multi-step create dialog**

Dialog flow:
1. **Type selection**: 4 buttons (Sales CN, Sales DN, Purchase DN, Purchase CN) — each shows the definition
2. **Party & Reference**: Customer/Supplier select + optional original invoice select
3. **Reason code**: Select from the 14 codes (filtered by type — return codes for return types, adjustment codes for adjustment types)
4. **Line items**: Add items with description, qty, unit price, PPN toggle
   - If linked to invoice: auto-populate items from invoice
   - Manual add for non-invoice-linked
5. **Summary**: Subtotal, PPN, Total + GL preview (auto-selected accounts)
6. **Save as Draft** or **Save & Post**

Style: neo-brutalist dialog with black borders, shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]

---

## Task 6: Settlement Dialog

**Files:**
- Create: `components/finance/dcnote-settlement-dialog.tsx`

**Step 1: Build settlement dialog**

When user clicks "Terapkan" on a POSTED note:
- Show list of outstanding invoices for the same customer/supplier
- Each invoice row: number, date, original amount, balance due, input for settlement amount
- Auto-fill: if note total <= invoice balance, pre-fill full amount
- Running total: "Sisa nota: Rp X"
- Submit: calls `settleDCNote()` server action
- After success: invalidate dcNotes, invoices, journal queries

---

## Task 7: Update Old Code — Remove Invoice Hack

**Files:**
- Modify: `lib/actions/finance.ts` — remove old `createCreditNote`, `createDebitNote`, `getCreditDebitNotes`, `getCreditDebitNoteAccounts`
- Modify: `components/finance/nota-kredit-tab.tsx` — update imports or remove if replaced
- Modify: `components/finance/nota-debit-tab.tsx` — update imports or remove if replaced

**Step 1: Remove old server actions from finance.ts**

Delete:
- `createCreditNote()` (lines ~3640-3711)
- `createDebitNote()` (lines ~3723-3790)
- `getCreditDebitNotes()` (lines ~3792-3837)
- `getCreditDebitNoteAccounts()` (lines ~3839-3856)
- Related interfaces `CreateCreditNoteInput`, `CreateDebitNoteInput`

**Step 2: Update or remove tab components**

If the page redesign (Task 4) replaces the tab components entirely, delete `nota-kredit-tab.tsx` and `nota-debit-tab.tsx`.

If they're still used elsewhere, update their imports to use new actions.

**Step 3: Clean up finance-ar.ts**

Check if `lib/actions/finance-ar.ts` has a duplicate `createCreditNote` — remove it.

**Step 4: Verify**

```bash
npx tsc --noEmit
npx vitest
```

---

## Task 8: Sidebar & Navigation

**Files:**
- Modify: `components/app-sidebar.tsx` — ensure Credit/Debit Notes link exists under Finance
- Modify: `hooks/use-nav-prefetch.ts` — add prefetch for `/finance/credit-notes`

**Step 1: Add/verify sidebar entry**

Under Finance section, ensure there's a nav item:
```
{ title: "Nota Kredit/Debit", url: "/finance/credit-notes", icon: FileText }
```

**Step 2: Add prefetch mapping**

```typescript
"/finance/credit-notes": {
    queryKey: queryKeys.dcNotes.list(),
    queryFn: () => getDCNotes(),
}
```

---

## Task 9: Integration Verification

**Files:** None (testing only)

**Step 1: End-to-end test scenarios**

Test each of the 4 document types:

1. **Sales CN (Nota Kredit Penjualan)**
   - Create → customer = any, reason = RET_DEFECT, add 1 item
   - Post → verify journal: DR 4000 Revenue, DR 2110 PPN Keluaran, CR 1100 Piutang
   - Settle against customer invoice → verify invoice balanceDue reduced

2. **Purchase DN (Nota Debit Pembelian)**
   - Create → supplier = any, reason = RET_WRONG, add 1 item
   - Post → verify journal: DR 2100 Hutang, CR 5000 HPP, CR 1330 PPN Masukan
   - Settle against supplier bill → verify bill balanceDue reduced

3. **Sales DN (Nota Debit Penjualan — additional charge)**
   - Create → customer = any, reason = ADJ_UNDERCHARGE
   - Post → verify journal: DR 1100 Piutang, CR 4000 Revenue

4. **Purchase CN (Nota Kredit Pembelian — supplier credit)**
   - Create → supplier = any, reason = ADJ_OVERCHARGE
   - Post → verify journal: DR 5000 HPP, CR 2100 Hutang

**Step 2: Void test**

- Post a note, settle partially, then void → verify reversals

**Step 3: Cross-module verification**

- After creating CN/DN, verify:
  - `/finance/journal` shows the journal entry
  - `/finance/invoices` shows updated balanceDue
  - KPIs on credit-notes page update correctly

---

## Implementation Notes

### GL Account Auto-Selection Rules (from spec)

| Note Type | Debit Account | Credit Account |
|-----------|--------------|----------------|
| SALES_CN | 4xxx Revenue + 2110 PPN Out | 1100 Piutang |
| SALES_DN | 1100 Piutang | 4xxx Revenue |
| PURCHASE_DN | 2100 Hutang | 5xxx HPP + 1330 PPN In |
| PURCHASE_CN | 5xxx HPP | 2100 Hutang |

### Number Format

| Type | Prefix | Example |
|------|--------|---------|
| SALES_CN | CN-S | CN-S-00001 |
| SALES_DN | DN-S | DN-S-00001 |
| PURCHASE_DN | DN-P | DN-P-00001 |
| PURCHASE_CN | CN-P | CN-P-00001 |

### Reason Code → Type Mapping

**Return reasons** (goods-related): RET_DEFECT, RET_WRONG, RET_QUALITY, RET_EXCESS, RET_EXPIRED
- Valid for: SALES_CN, PURCHASE_DN

**Adjustment reasons** (price/billing): ADJ_OVERCHARGE, ADJ_DISCOUNT, ADJ_UNDERCHARGE, ADJ_ADDCHARGE, ADJ_PENALTY, ADJ_REBATE, ADJ_GOODWILL
- Valid for: All types

**Service reasons**: SVC_CANCEL, SVC_SHORT
- Valid for: SALES_CN, PURCHASE_DN

**Order reasons**: ORD_CANCEL
- Valid for: All types

### Reason Code Labels (Bahasa Indonesia)

```typescript
const REASON_LABELS: Record<string, string> = {
  RET_DEFECT: "Barang Cacat/Rusak",
  RET_WRONG: "Barang Tidak Sesuai Pesanan",
  RET_QUALITY: "Kualitas Tidak Standar",
  RET_EXCESS: "Kelebihan Kirim",
  RET_EXPIRED: "Barang Kadaluarsa",
  ADJ_OVERCHARGE: "Kelebihan Tagih",
  ADJ_DISCOUNT: "Diskon Belum Dipotong",
  ADJ_UNDERCHARGE: "Kekurangan Tagih",
  ADJ_ADDCHARGE: "Biaya Tambahan",
  SVC_CANCEL: "Pembatalan Jasa",
  SVC_SHORT: "Jasa Tidak Lengkap",
  ORD_CANCEL: "Pembatalan Pesanan",
  ADJ_PENALTY: "Penalti / Denda",
  ADJ_REBATE: "Potongan Volume (Rebate)",
  ADJ_GOODWILL: "Penyesuaian Goodwill",
}
```

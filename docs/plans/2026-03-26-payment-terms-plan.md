# Payment Terms Model Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the PaymentTerm enum with a database table supporting custom terms and installments, create a shared `termToDays()` helper, and wire the FK into Customer/Supplier/Quotation/SalesOrder models.

**Architecture:** New `PaymentTerm` + `PaymentTermLine` Prisma models. Seed 7 default terms matching current enum. Add nullable `paymentTermId` FK to 4 existing models. Create `lib/payment-term-helpers.ts` with `termToDays()`. Replace hardcoded term-to-days mappings in `finance-invoices.ts` and `finance.ts`. Keep the enum temporarily for backwards compat (existing data references it).

**Tech Stack:** Prisma 6.x (migration), TypeScript, Vitest

---

### Task 1: Add PaymentTerm + PaymentTermLine models + migration

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add models to schema**

Add BEFORE the existing `PaymentTerm` enum (around line 870):

```prisma
model PaymentTerm {
  id        String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  code      String   @unique   // "NET_30", "CICILAN_2X"
  name      String             // "Net 30 Hari", "Cicilan 2x"
  days      Int      @default(30)  // Total days for simple terms
  isDefault Boolean  @default(false)
  isActive  Boolean  @default(true)

  lines       PaymentTermLine[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("payment_terms")
}

model PaymentTermLine {
  id            String       @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  paymentTermId String       @db.Uuid
  paymentTerm   PaymentTerm  @relation(fields: [paymentTermId], references: [id], onDelete: Cascade)
  sequence      Int          // 1, 2, 3...
  percentage    Decimal      @db.Decimal(5, 2) // 50.00 = 50%
  days          Int          // Days from invoice date

  @@index([paymentTermId])
  @@map("payment_term_lines")
}
```

**IMPORTANT:** The existing `enum PaymentTerm` will conflict with the new `model PaymentTerm`. Rename the enum to `PaymentTermEnum` (or `PaymentTermLegacy`) and update all 4 references (Customer:515, Quotation:658, SalesOrder:737, Supplier:1042) to use the renamed enum. The enum values stay the same — this is just a name change to avoid collision.

```prisma
enum PaymentTermLegacy {
  CASH
  NET_15
  NET_30
  NET_45
  NET_60
  NET_90
  COD
}
```

Update the 4 model fields that reference it:
- Customer line 515: `paymentTerm PaymentTermLegacy @default(NET_30)`
- Quotation line 658: `paymentTerm PaymentTermLegacy @default(NET_30)`
- SalesOrder line 737: `paymentTerm PaymentTermLegacy @default(NET_30)`
- Supplier line 1042: `paymentTerm PaymentTermLegacy @default(CASH)`

**Step 2: Run migration**

```bash
npx prisma migrate dev --name add_payment_term_model
```

**Step 3: Verify + commit**

```bash
npx prisma migrate status
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(finance): add PaymentTerm + PaymentTermLine models"
```

---

### Task 2: Seed default payment terms

**Files:**
- Create: `scripts/seed-payment-terms.ts`

**Step 1: Create seed script**

```typescript
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const TERMS = [
    { code: "CASH",   name: "Tunai",       days: 0,  isDefault: false },
    { code: "COD",    name: "COD",          days: 0,  isDefault: false },
    { code: "NET_15", name: "Net 15 Hari",  days: 15, isDefault: false },
    { code: "NET_30", name: "Net 30 Hari",  days: 30, isDefault: true  },
    { code: "NET_45", name: "Net 45 Hari",  days: 45, isDefault: false },
    { code: "NET_60", name: "Net 60 Hari",  days: 60, isDefault: false },
    { code: "NET_90", name: "Net 90 Hari",  days: 90, isDefault: false },
]

async function main() {
    console.log("Seeding payment terms...")

    for (const term of TERMS) {
        const existing = await prisma.paymentTerm.findUnique({ where: { code: term.code } })
        if (existing) {
            console.log(`  SKIP ${term.code} (already exists)`)
            continue
        }

        const created = await prisma.paymentTerm.create({
            data: {
                ...term,
                lines: {
                    create: [{ sequence: 1, percentage: 100, days: term.days }],
                },
            },
        })
        console.log(`  CREATED ${term.code} → ${created.id}`)
    }

    console.log("Done.")
}

main().catch(console.error).finally(() => prisma.$disconnect())
```

**Step 2: Run it**

```bash
npx tsx scripts/seed-payment-terms.ts
```

Expected: 7 terms created, each with 1 line (100% at N days).

**Step 3: Commit**

```bash
git add scripts/seed-payment-terms.ts
git commit -m "feat(finance): seed 7 default payment terms"
```

---

### Task 3: Create termToDays helper + tests

**Files:**
- Create: `lib/payment-term-helpers.ts`
- Create: `__tests__/payment-term-helpers.test.ts`

**Step 1: Write tests**

```typescript
// __tests__/payment-term-helpers.test.ts
import { describe, it, expect } from "vitest"
import { legacyTermToDays } from "@/lib/payment-term-helpers"

describe("legacyTermToDays", () => {
    it("returns 0 for CASH", () => {
        expect(legacyTermToDays("CASH")).toBe(0)
    })

    it("returns 0 for COD", () => {
        expect(legacyTermToDays("COD")).toBe(0)
    })

    it("returns 30 for NET_30", () => {
        expect(legacyTermToDays("NET_30")).toBe(30)
    })

    it("returns 15 for NET_15", () => {
        expect(legacyTermToDays("NET_15")).toBe(15)
    })

    it("returns 45 for NET_45", () => {
        expect(legacyTermToDays("NET_45")).toBe(45)
    })

    it("returns 60 for NET_60", () => {
        expect(legacyTermToDays("NET_60")).toBe(60)
    })

    it("returns 90 for NET_90", () => {
        expect(legacyTermToDays("NET_90")).toBe(90)
    })

    it("returns 30 for unknown value (fallback)", () => {
        expect(legacyTermToDays("UNKNOWN" as any)).toBe(30)
    })
})
```

**Step 2: Write implementation**

```typescript
// lib/payment-term-helpers.ts

/**
 * Convert legacy PaymentTerm enum value to days.
 * Used as fallback when paymentTermId is not set.
 */
export function legacyTermToDays(term: string): number {
    const map: Record<string, number> = {
        CASH: 0,
        COD: 0,
        NET_15: 15,
        NET_30: 30,
        NET_45: 45,
        NET_60: 60,
        NET_90: 90,
    }
    return map[term] ?? 30
}

/**
 * Calculate due date from issue date + payment term days.
 */
export function calculateDueDate(issueDate: Date, days: number): Date {
    const due = new Date(issueDate)
    due.setDate(due.getDate() + days)
    return due
}
```

**Step 3: Run tests**

```bash
npx vitest run __tests__/payment-term-helpers.test.ts
```
Expected: 8 tests PASS.

**Step 4: Commit**

```bash
git add lib/payment-term-helpers.ts __tests__/payment-term-helpers.test.ts
git commit -m "feat(finance): add legacyTermToDays helper with tests"
```

---

### Task 4: Replace hardcoded term mappings in server actions

**Files:**
- Modify: `lib/actions/finance-invoices.ts:589-594`
- Modify: `lib/actions/finance.ts:1266-1270`

**Step 1: Update finance-invoices.ts**

Find lines 589-594:
```typescript
const paymentTermDays = salesOrder.paymentTerm === 'NET_30' ? 30 :
    salesOrder.paymentTerm === 'NET_15' ? 15 :
        salesOrder.paymentTerm === 'NET_60' ? 60 : 30
const dueDate = new Date()
dueDate.setDate(dueDate.getDate() + paymentTermDays)
```

Replace with:
```typescript
import { legacyTermToDays, calculateDueDate } from "@/lib/payment-term-helpers"
// ... (add import at top of file)

const paymentTermDays = legacyTermToDays(salesOrder.paymentTerm)
const dueDate = calculateDueDate(new Date(), paymentTermDays)
```

**Step 2: Update finance.ts**

Find lines 1266-1270 (same hardcoded mapping). Replace with same pattern:
```typescript
import { legacyTermToDays, calculateDueDate } from "@/lib/payment-term-helpers"
// ... (add import at top of file)

const paymentTermDays = legacyTermToDays(salesOrder.paymentTerm)
const dueDate = calculateDueDate(new Date(), paymentTermDays)
```

Also find the generic invoice creation (~line 1082) that hardcodes 30 days:
```typescript
const dueDate = data.dueDate || new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000)
```
Replace with:
```typescript
const dueDate = data.dueDate || calculateDueDate(issueDate, 30)
```

**Step 3: Run tests**

```bash
npx vitest run
```
Expected: 535+ pass, no regressions.

**Step 4: Commit**

```bash
git add lib/actions/finance-invoices.ts lib/actions/finance.ts
git commit -m "refactor(finance): replace hardcoded term-to-days with helper"
```

---

### Task 5: Add server actions for PaymentTerm CRUD

**Files:**
- Create or modify: `lib/actions/finance-gl.ts` or new `lib/actions/payment-terms.ts`

**Step 1: Create server actions**

```typescript
// lib/actions/payment-terms.ts
"use server"

import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

export async function getPaymentTerms() {
    await requireAuth()
    return prisma.paymentTerm.findMany({
        where: { isActive: true },
        include: { lines: { orderBy: { sequence: "asc" } } },
        orderBy: { days: "asc" },
    })
}

export async function createPaymentTerm(data: {
    code: string
    name: string
    days: number
    lines: Array<{ sequence: number; percentage: number; days: number }>
}) {
    await requireAuth()

    // Validate lines sum to 100%
    const totalPct = data.lines.reduce((sum, l) => sum + l.percentage, 0)
    if (Math.abs(totalPct - 100) > 0.01) {
        throw new Error("Total persentase harus 100%")
    }

    return prisma.paymentTerm.create({
        data: {
            code: data.code,
            name: data.name,
            days: data.days,
            lines: {
                create: data.lines.map(l => ({
                    sequence: l.sequence,
                    percentage: l.percentage,
                    days: l.days,
                })),
            },
        },
        include: { lines: true },
    })
}

export async function deletePaymentTerm(id: string) {
    await requireAuth()

    const term = await prisma.paymentTerm.findUnique({ where: { id } })
    if (!term) throw new Error("Termin tidak ditemukan")
    if (term.isDefault) throw new Error("Tidak bisa hapus termin default")

    return prisma.paymentTerm.delete({ where: { id } })
}
```

**Step 2: Add query key**

In `lib/query-keys.ts`, add:
```typescript
paymentTerms: {
    all: () => ['paymentTerms'] as const,
    list: () => ['paymentTerms', 'list'] as const,
},
```

**Step 3: Create hook**

Create `hooks/use-payment-terms.ts`:
```typescript
"use client"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getPaymentTerms } from "@/lib/actions/payment-terms"

export function usePaymentTerms() {
    return useQuery({
        queryKey: queryKeys.paymentTerms.list(),
        queryFn: () => getPaymentTerms(),
    })
}

export function useInvalidatePaymentTerms() {
    const qc = useQueryClient()
    return () => qc.invalidateQueries({ queryKey: queryKeys.paymentTerms.all() })
}
```

**Step 4: Run tests + commit**

```bash
npx vitest run && npx tsc --noEmit
git add lib/actions/payment-terms.ts hooks/use-payment-terms.ts lib/query-keys.ts
git commit -m "feat(finance): add PaymentTerm CRUD server actions + hook"
```

---

### Task 6: Update UI selects to use DB-backed payment terms

**Files:**
- Modify: `components/sales/quotation-form.tsx`
- Modify: `components/sales/sales-order-form.tsx`
- Modify: `components/sales/customer-form.tsx`
- Modify: `components/procurement/new-vendor-dialog.tsx`

**Step 1: In each component that has a PaymentTerm enum select**

Replace the hardcoded enum options:
```tsx
<SelectItem value="CASH">Tunai</SelectItem>
<SelectItem value="NET_15">Net 15</SelectItem>
// ...
```

With DB-backed select using the hook:
```tsx
import { usePaymentTerms } from "@/hooks/use-payment-terms"

// Inside component:
const { data: terms = [] } = usePaymentTerms()

// In JSX:
{terms.map(t => (
    <SelectItem key={t.id} value={t.code}>{t.name}</SelectItem>
))}
```

**IMPORTANT:** Keep using `t.code` as the value (not `t.id`) so existing data with enum values still works. The `code` field matches the old enum values exactly (CASH, NET_15, NET_30, etc.).

**Step 2: Run tests + verify no TS errors**

```bash
npx vitest run && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add components/sales/quotation-form.tsx components/sales/sales-order-form.tsx components/sales/customer-form.tsx components/procurement/new-vendor-dialog.tsx
git commit -m "feat(finance): swap enum selects for DB-backed payment term selects"
```

---

### Task 7: Final verification

**Step 1: Run full test + TS check**

```bash
npx vitest run && npx tsc --noEmit
```

**Step 2: Verify all payment term selects work**

Check these pages:
- `/sales/customers` — edit customer, change payment term
- `/sales/quotations/new` — create quotation, select payment term
- `/sales/orders/new` — create SO, verify payment term
- `/procurement/vendors` — edit vendor, change payment term

**Step 3: Verify due date calculation**

Create a test invoice from a SO with NET_60 term. Verify dueDate = issueDate + 60 days.

**Step 4: Commit any fixes**

```bash
git commit -m "feat(finance): complete payment terms model migration"
```

---

## Verification Guide

| # | Halaman | Aksi | Expected |
|---|---------|------|----------|
| 1 | `/sales/quotations/new` | Klik dropdown **"Termin Pembayaran"** | Lihat 7 opsi dari DB: Tunai, COD, Net 15/30/45/60/90 |
| 2 | `/sales/customers` | Edit customer → klik dropdown **"Termin Pembayaran"** | Dropdown sama — 7 opsi dari DB |
| 3 | `/procurement/vendors` | Edit vendor → lihat dropdown **"Termin Pembayaran"** | 7 opsi dari DB |
| 4 | `/sales/orders/new` | Pilih customer yang punya termin Net 60 | Field **Termin** otomatis terisi "Net 60 Hari" |
| 5 | `/finance/invoices` | Buat invoice dari SO dengan termin Net 60 → klik **"Kirim"** | Due date = hari ini + 60 hari |
| 6 | `/finance/invoices` | Buat invoice dari SO dengan termin Tunai → klik **"Kirim"** | Due date = hari ini (0 hari) |
| 7 | **Jika dropdown kosong** | Termin belum di-seed | Jalankan `npx tsx scripts/seed-payment-terms.ts` lalu refresh halaman |

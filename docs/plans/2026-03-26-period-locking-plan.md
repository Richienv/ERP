# Period Locking — Complete Enforcement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent financial mutations (bill approval, invoice posting, payments, petty cash, DCNotes) from executing when the target fiscal period is closed — by failing fast BEFORE status changes, not after.

**Architecture:** Create a shared `assertPeriodOpen(date)` helper in `lib/period-helpers.ts`. Add calls at the top of every financial mutation function, before any status change or GL posting. Refactor existing inline check in `postJournalEntry()` to use the same helper. The helper uses the singleton `prisma` (no auth needed for a read-only FiscalPeriod lookup).

**Tech Stack:** Prisma (FiscalPeriod model), Vitest (tests), TypeScript

---

### Task 1: Create `assertPeriodOpen()` helper + tests

**Files:**
- Create: `lib/period-helpers.ts`
- Create: `__tests__/period-helpers.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/period-helpers.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock prisma
const mockFindUnique = vi.fn()
vi.mock("@/lib/db", () => ({
    prisma: {
        fiscalPeriod: {
            findUnique: (...args: any[]) => mockFindUnique(...args),
        },
    },
}))

import { assertPeriodOpen } from "@/lib/period-helpers"

describe("assertPeriodOpen", () => {
    beforeEach(() => {
        mockFindUnique.mockReset()
    })

    it("throws when period is closed", async () => {
        mockFindUnique.mockResolvedValue({
            isClosed: true,
            name: "Maret 2026",
        })

        await expect(assertPeriodOpen(new Date("2026-03-15")))
            .rejects.toThrow("Periode fiskal Maret 2026 sudah ditutup")
    })

    it("passes when period is open", async () => {
        mockFindUnique.mockResolvedValue({
            isClosed: false,
            name: "Maret 2026",
        })

        await expect(assertPeriodOpen(new Date("2026-03-15")))
            .resolves.not.toThrow()
    })

    it("passes when no fiscal period record exists (not yet created)", async () => {
        mockFindUnique.mockResolvedValue(null)

        await expect(assertPeriodOpen(new Date("2026-03-15")))
            .resolves.not.toThrow()
    })

    it("extracts correct year and month from date", async () => {
        mockFindUnique.mockResolvedValue(null)

        await assertPeriodOpen(new Date("2026-07-20"))

        expect(mockFindUnique).toHaveBeenCalledWith({
            where: { year_month: { year: 2026, month: 7 } },
        })
    })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/period-helpers.test.ts`
Expected: FAIL — `Cannot find module '@/lib/period-helpers'`

**Step 3: Write the implementation**

```typescript
// lib/period-helpers.ts
import { prisma } from "@/lib/db"

/**
 * Throws if the fiscal period for `date` is closed.
 * Call this at the TOP of any financial mutation — before status changes.
 *
 * Uses singleton prisma (no auth needed for read-only FiscalPeriod lookup).
 * Safe to call inside or outside withPrismaAuth.
 */
export async function assertPeriodOpen(date: Date): Promise<void> {
    const d = new Date(date)
    const month = d.getMonth() + 1
    const year = d.getFullYear()

    const period = await prisma.fiscalPeriod.findUnique({
        where: { year_month: { year, month } },
    })

    if (period?.isClosed) {
        throw new Error(
            `Periode fiskal ${period.name} sudah ditutup. Tidak bisa posting ke periode ini.`
        )
    }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/period-helpers.test.ts`
Expected: ALL 4 tests PASS

**Step 5: Commit**

```bash
git add lib/period-helpers.ts __tests__/period-helpers.test.ts
git commit -m "feat(gl): add assertPeriodOpen() helper with tests"
```

---

### Task 2: Refactor `postJournalEntry()` to use helper

**Files:**
- Modify: `lib/actions/finance-gl.ts:130-161`

**Step 1: Replace inline period check with helper call**

In `lib/actions/finance-gl.ts`, replace lines 152-161 (the inline period check inside `withPrismaAuth`) with a single call BEFORE `withPrismaAuth`:

```typescript
// BEFORE (lines 143-151 of postJournalEntry):
    try {
        const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0)
        const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0)

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new Error(`Unbalanced Journal: Debit (${totalDebit}) != Credit (${totalCredit})`)
        }

        return await withPrismaAuth(async (prisma) => {
            // Check if fiscal period is closed for the journal date
            const entryDate = new Date(data.date)
            const entryMonth = entryDate.getMonth() + 1
            const entryYear = entryDate.getFullYear()
            const fiscalPeriod = await prisma.fiscalPeriod.findUnique({
                where: { year_month: { year: entryYear, month: entryMonth } }
            })
            if (fiscalPeriod?.isClosed) {
                throw new Error(`Periode fiskal ${fiscalPeriod.name} sudah ditutup. Tidak bisa posting jurnal ke periode ini.`)
            }

// AFTER:
    try {
        const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0)
        const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0)

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new Error(`Unbalanced Journal: Debit (${totalDebit}) != Credit (${totalCredit})`)
        }

        // Fail fast: check period lock BEFORE acquiring withPrismaAuth transaction
        await assertPeriodOpen(data.date)

        return await withPrismaAuth(async (prisma) => {
```

Add the import at top of file:
```typescript
import { assertPeriodOpen } from "@/lib/period-helpers"
```

**Step 2: Run existing tests to verify nothing breaks**

Run: `npx vitest run`
Expected: Same pass count as before (296/301 baseline)

**Step 3: Commit**

```bash
git add lib/actions/finance-gl.ts
git commit -m "refactor(gl): use assertPeriodOpen helper in postJournalEntry"
```

---

### Task 3: Guard `finance-ap.ts` — bill approval & payments

**Files:**
- Modify: `lib/actions/finance-ap.ts`

**Step 1: Add import at top of file**

```typescript
import { assertPeriodOpen } from "@/lib/period-helpers"
```

**Step 2: Add pre-check to `approveVendorBill()` (line ~205)**

Add AFTER `if (bill.status !== 'DRAFT')` check (line 220), BEFORE the status update (line 222):

```typescript
            if (bill.status !== 'DRAFT') throw new Error("Bill already processed")

            // Period lock: fail fast before changing status
            await assertPeriodOpen(new Date())

            // 2. Update Status to ISSUED (Approved)
```

**Step 3: Add pre-check to `recordVendorPayment()` (line ~374)**

Add early in the function, after fetching the bill but before any mutations:

```typescript
            // Period lock: fail fast before recording payment
            await assertPeriodOpen(data.date || new Date())
```

**Step 4: Add pre-check to `recordMultiBillPayment()` (line ~489)**

Same pattern — add before any mutations:

```typescript
            // Period lock: fail fast before recording multi-bill payment
            await assertPeriodOpen(data.date || new Date())
```

**Step 5: Add pre-check to `approveAndPayBill()` (line ~749)**

```typescript
            // Period lock: fail fast before approve+pay
            await assertPeriodOpen(new Date())
```

**Step 6: Run tests**

Run: `npx vitest run`
Expected: Same pass count

**Step 7: Commit**

```bash
git add lib/actions/finance-ap.ts
git commit -m "feat(ap): add period lock checks to bill approval & payment"
```

---

### Task 4: Guard `finance-ar.ts` — AR payments & credit notes

**Files:**
- Modify: `lib/actions/finance-ar.ts`

**Step 1: Add import at top of file**

```typescript
import { assertPeriodOpen } from "@/lib/period-helpers"
```

**Step 2: Guard functions — add `await assertPeriodOpen(...)` early in each function, before any DB mutations:**

| Function | Line | Date to check |
|----------|------|---------------|
| `createCreditNote()` | ~11 | `new Date()` |
| `processRefund()` | ~110 | `new Date()` |
| `createPaymentVoucher()` | ~184 | `new Date()` |
| `processGIROClearing()` | ~288 | `new Date()` |
| `recordARPayment()` | ~770 | `data.date \|\| new Date()` |
| `matchPaymentToInvoice()` | ~866 | `new Date()` |

For each function, add after initial validation (null checks, status checks) but BEFORE any `prisma.create/update`:

```typescript
            // Period lock: fail fast before mutation
            await assertPeriodOpen(dateValue)
```

**Step 3: Run tests**

Run: `npx vitest run`
Expected: Same pass count

**Step 4: Commit**

```bash
git add lib/actions/finance-ar.ts
git commit -m "feat(ar): add period lock checks to payments & credit notes"
```

---

### Task 5: Guard `finance-invoices.ts` — invoice posting & payment

**Files:**
- Modify: `lib/actions/finance-invoices.ts`

**Step 1: Add import at top of file**

```typescript
import { assertPeriodOpen } from "@/lib/period-helpers"
```

**Step 2: Guard `moveInvoiceToSent()` (line 749)**

Add BEFORE the `withPrismaAuth` call (line 751), right after the function opens:

```typescript
export async function moveInvoiceToSent(invoiceId: string, message?: string, method?: 'WHATSAPP' | 'EMAIL') {
    try {
        // Period lock: fail fast before changing invoice status
        await assertPeriodOpen(new Date())

        const txResult = await withPrismaAuth(async (prisma) => {
```

**Step 3: Guard `recordInvoicePayment()` (line ~869)**

Same pattern — add at top of try block:

```typescript
        // Period lock: fail fast before recording payment
        await assertPeriodOpen(new Date())
```

**Step 4: Run tests**

Run: `npx vitest run`
Expected: Same pass count

**Step 5: Commit**

```bash
git add lib/actions/finance-invoices.ts
git commit -m "feat(invoices): add period lock checks to send & payment"
```

---

### Task 6: Guard `finance-petty-cash.ts` — top-up & disbursement

**Files:**
- Modify: `lib/actions/finance-petty-cash.ts`

**Step 1: Add import at top of file**

```typescript
import { assertPeriodOpen } from "@/lib/period-helpers"
```

**Step 2: Guard `topUpPettyCash()` (line 71)**

Add after `await requireAuth()` (line 76):

```typescript
    await requireAuth()
    await assertPeriodOpen(new Date())
```

**Step 3: Guard `disbursePettyCash()` (line 128)**

Same — after `await requireAuth()` (line 134):

```typescript
    await requireAuth()
    await assertPeriodOpen(new Date())
```

**Step 4: Run tests**

Run: `npx vitest run`
Expected: Same pass count

**Step 5: Commit**

```bash
git add lib/actions/finance-petty-cash.ts
git commit -m "feat(petty-cash): add period lock checks"
```

---

### Task 7: Guard `sales.ts` — invoice approval & payment

**Files:**
- Modify: `lib/actions/sales.ts`

**Step 1: Add import at top of file**

```typescript
import { assertPeriodOpen } from "@/lib/period-helpers"
```

**Step 2: Guard `approveInvoice()` (line ~250)**

Add before GL posting:

```typescript
            // Period lock: fail fast
            await assertPeriodOpen(new Date())
```

**Step 3: Guard `recordPayment()` (line ~306)**

Same:

```typescript
            // Period lock: fail fast
            await assertPeriodOpen(new Date())
```

**Step 4: Guard `processReturn()` (line ~1386)**

Same pattern.

**Step 5: Run tests**

Run: `npx vitest run`
Expected: Same pass count

**Step 6: Commit**

```bash
git add lib/actions/sales.ts
git commit -m "feat(sales): add period lock checks to approval & payment"
```

---

### Task 8: Final verification

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: 296+ tests pass (same as baseline)

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 3: Grep to verify coverage — every file that imports `postJournalEntry` should now also import `assertPeriodOpen`**

Run: `grep -rn "postJournalEntry" --include="*.ts" lib/actions/ | grep -v "import" | grep -v "export" | grep -v "//"` — find callers
Run: `grep -rn "assertPeriodOpen" --include="*.ts" lib/actions/` — find guarded files

Compare the two lists. Every file in list 1 should be in list 2.

**Step 4: Commit any fixes, then final commit**

```bash
git add -A
git commit -m "feat(gl): complete period lock enforcement across all finance mutations"
```

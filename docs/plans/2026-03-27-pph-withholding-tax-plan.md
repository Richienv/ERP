# PPh Withholding Tax Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add PPh 23 and PPh 4(2) withholding tax support to vendor/AR payments with proper GL posting, Bukti Potong tracking, deposit management, and a PPh report tab. Also fix PPh 21 payroll GL to use a proper liability account.

**Architecture:** New `WithholdingTax` model linked to `Payment`. Withholding is recorded at payment time (not bill issuance). GL splits payment into net cash + tax liability. Separate deposit flow clears the liability when remitted to DJP.

**Tech Stack:** Prisma schema + migration, server actions (finance-ap.ts, finance-ar.ts, finance-invoices.ts, new finance-pph.ts), sync helpers (pph-helpers.ts), React UI (payment dialogs + report tab), Vitest tests.

**Design doc:** `docs/plans/2026-03-27-pph-withholding-tax-design.md`

---

## Task 1: Schema — Enums, Model, Relations

**Files:**
- Modify: `prisma/schema.prisma`
- Run: `npx prisma migrate dev --name add_withholding_tax`

**Step 1: Add PPhType and WithholdingDirection enums**

Add after the `PaymentMethod` enum (~line 1922 in schema.prisma):

```prisma
enum PPhType {
  PPH_21
  PPH_23
  PPH_4_2
}

enum WithholdingDirection {
  OUT // We withhold from vendor (AP)
  IN  // Customer withholds from us (AR)
}
```

**Step 2: Add WithholdingTax model**

Add after the Payment model (after line 1898):

```prisma
model WithholdingTax {
  id              String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  paymentId       String   @db.Uuid
  invoiceId       String?  @db.Uuid

  type            PPhType
  direction       WithholdingDirection

  rate            Decimal  @db.Decimal(5, 2)
  baseAmount      Decimal  @db.Decimal(15, 2)
  amount          Decimal  @db.Decimal(15, 2)

  buktiPotongNo   String?
  buktiPotongDate DateTime?

  deposited       Boolean  @default(false)
  depositDate     DateTime?
  depositRef      String?

  payment         Payment  @relation(fields: [paymentId], references: [id])
  invoice         Invoice? @relation(fields: [invoiceId], references: [id])

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([type, deposited])
  @@index([paymentId])
  @@map("withholding_taxes")
}
```

**Step 3: Add reverse relations on Payment and Invoice**

In the `Payment` model (before `@@map("payments")` on line 1897), add:
```prisma
  withholdingTaxes WithholdingTax[]
```

In the `Invoice` model (before `@@map("invoices")` on line 1840), add:
```prisma
  withholdingTaxes WithholdingTax[]
```

**Step 4: Run migration**

```bash
npx prisma migrate dev --name add_withholding_tax
```

**Step 5: Regenerate Prisma client**

```bash
npx prisma generate
```

**Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(pph): add WithholdingTax model, PPhType + WithholdingDirection enums"
```

---

## Task 2: GL Accounts — New PPh Accounts

**Files:**
- Modify: `lib/gl-accounts.ts` (lines 16-88)
- Modify: `prisma/seed-gl.ts` (lines 30-86)

**Step 1: Add account codes to SYS_ACCOUNTS**

In `lib/gl-accounts.ts`, after `PPN_MASUKAN: "1330"` (line 32), add:

```typescript
  PPH_PREPAID:    "1340",  // PPh Dibayar Dimuka (when customer withholds from us)
```

After `PPN_KELUARAN: "2110"` (line 38), add:

```typescript
  PPH_21_PAYABLE: "2210",  // Utang PPh 21 (employee payroll withholding)
  PPH_23_PAYABLE: "2220",  // Utang PPh 23 (vendor service withholding)
  PPH_4_2_PAYABLE: "2230", // Utang PPh 4(2) (final tax: rent, construction)
```

**Step 2: Add to SYSTEM_ACCOUNT_DEFS array**

In `lib/gl-accounts.ts`, after the `PPN_MASUKAN` entry (line 75), add:

```typescript
  { code: SYS_ACCOUNTS.PPH_PREPAID,     name: "PPh Dibayar Dimuka",    type: "ASSET" },
```

After the `PPN_KELUARAN` entry (line 78), add:

```typescript
  { code: SYS_ACCOUNTS.PPH_21_PAYABLE,  name: "Utang PPh 21",         type: "LIABILITY" },
  { code: SYS_ACCOUNTS.PPH_23_PAYABLE,  name: "Utang PPh 23",         type: "LIABILITY" },
  { code: SYS_ACCOUNTS.PPH_4_2_PAYABLE, name: "Utang PPh 4(2)",       type: "LIABILITY" },
```

**Step 3: Add to seed-gl.ts**

In `prisma/seed-gl.ts`, after `{ code: '1330', ...PPN Masukan... }` (line 33), add:

```typescript
        { code: '1340', name: 'PPh Dibayar Dimuka', type: 'ASSET', isSystem: true },
```

After `{ code: '2121', ...Pendapatan Diterima Dimuka... }` (line 47), add:

```typescript
        { code: '2210', name: 'Utang PPh 21', type: 'LIABILITY', isSystem: true },
        { code: '2220', name: 'Utang PPh 23', type: 'LIABILITY', isSystem: true },
        { code: '2230', name: 'Utang PPh 4(2)', type: 'LIABILITY', isSystem: true },
```

**Step 4: Commit**

```bash
git add lib/gl-accounts.ts prisma/seed-gl.ts
git commit -m "feat(pph): add PPh GL accounts (1340, 2210, 2220, 2230)"
```

---

## Task 3: PPh Helpers + Tests (TDD)

**Files:**
- Create: `lib/pph-helpers.ts`
- Create: `__tests__/pph-helpers.test.ts`

**Step 1: Write failing tests**

Create `__tests__/pph-helpers.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import {
  calculateWithholding,
  getDefaultRate,
  getDepositDeadline,
  getFilingDeadline,
  adjustRateForNpwp,
  getPPhLiabilityAccount,
  PPH_RATES,
} from "@/lib/pph-helpers"

describe("PPH_RATES constants", () => {
  it("has correct default rates", () => {
    expect(PPH_RATES.PPH_23_SERVICES).toBe(2)
    expect(PPH_RATES.PPH_23_ROYALTY).toBe(15)
    expect(PPH_RATES.PPH_4_2_RENT).toBe(10)
    expect(PPH_RATES.PPH_4_2_CONSTRUCTION_SMALL).toBe(1.75)
    expect(PPH_RATES.PPH_4_2_CONSTRUCTION_MED).toBe(2.65)
    expect(PPH_RATES.PPH_4_2_CONSTRUCTION_LARGE).toBe(4)
  })
})

describe("getDefaultRate", () => {
  it("returns 2 for PPH_23", () => {
    expect(getDefaultRate("PPH_23")).toBe(2)
  })
  it("returns 10 for PPH_4_2", () => {
    expect(getDefaultRate("PPH_4_2")).toBe(10)
  })
  it("returns 0 for PPH_21 (calculated separately)", () => {
    expect(getDefaultRate("PPH_21")).toBe(0)
  })
})

describe("calculateWithholding", () => {
  it("calculates PPh 23 at 2% on Rp20M", () => {
    const result = calculateWithholding(2, 20_000_000)
    expect(result.amount).toBe(400_000)
    expect(result.netAmount).toBe(19_600_000)
  })

  it("calculates PPh 4(2) at 10% on Rp100M", () => {
    const result = calculateWithholding(10, 100_000_000)
    expect(result.amount).toBe(10_000_000)
    expect(result.netAmount).toBe(90_000_000)
  })

  it("calculates PPh 23 royalty at 15%", () => {
    const result = calculateWithholding(15, 50_000_000)
    expect(result.amount).toBe(7_500_000)
    expect(result.netAmount).toBe(42_500_000)
  })

  it("handles zero base amount", () => {
    const result = calculateWithholding(2, 0)
    expect(result.amount).toBe(0)
    expect(result.netAmount).toBe(0)
  })

  it("rounds to nearest rupiah", () => {
    const result = calculateWithholding(2, 33_333)
    expect(result.amount).toBe(667) // Math.round(666.66)
    expect(result.netAmount).toBe(32_666)
  })
})

describe("adjustRateForNpwp", () => {
  it("doubles PPh 23 rate when no NPWP", () => {
    expect(adjustRateForNpwp("PPH_23", 2, false)).toBe(4)
  })

  it("keeps PPh 23 rate when has NPWP", () => {
    expect(adjustRateForNpwp("PPH_23", 2, true)).toBe(2)
  })

  it("does NOT double PPh 4(2) — it is final tax", () => {
    expect(adjustRateForNpwp("PPH_4_2", 10, false)).toBe(10)
  })

  it("does NOT double PPh 21", () => {
    expect(adjustRateForNpwp("PPH_21", 5, false)).toBe(5)
  })
})

describe("getDepositDeadline", () => {
  it("returns 10th of next month", () => {
    const result = getDepositDeadline(new Date("2026-03-15"))
    expect(result).toEqual(new Date("2026-04-10"))
  })

  it("handles December → January rollover", () => {
    const result = getDepositDeadline(new Date("2026-12-20"))
    expect(result).toEqual(new Date("2027-01-10"))
  })
})

describe("getFilingDeadline", () => {
  it("returns 20th of next month", () => {
    const result = getFilingDeadline(new Date("2026-03-15"))
    expect(result).toEqual(new Date("2026-04-20"))
  })

  it("handles December → January rollover", () => {
    const result = getFilingDeadline(new Date("2026-12-20"))
    expect(result).toEqual(new Date("2027-01-20"))
  })
})

describe("getPPhLiabilityAccount", () => {
  it("returns 2210 for PPH_21", () => {
    expect(getPPhLiabilityAccount("PPH_21")).toBe("2210")
  })
  it("returns 2220 for PPH_23", () => {
    expect(getPPhLiabilityAccount("PPH_23")).toBe("2220")
  })
  it("returns 2230 for PPH_4_2", () => {
    expect(getPPhLiabilityAccount("PPH_4_2")).toBe("2230")
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run __tests__/pph-helpers.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement pph-helpers.ts**

Create `lib/pph-helpers.ts`:

```typescript
// lib/pph-helpers.ts
// Sync PPh (withholding tax) calculation helpers.
// NOT "use server" — these are pure functions importable anywhere.

import { SYS_ACCOUNTS } from "@/lib/gl-accounts"

export const PPH_RATES = {
  PPH_23_SERVICES: 2,             // Jasa teknik, manajemen, konsultan
  PPH_23_ROYALTY: 15,             // Dividen, bunga, royalti
  PPH_4_2_RENT: 10,              // Sewa tanah/bangunan
  PPH_4_2_CONSTRUCTION_SMALL: 1.75, // Konstruksi kecil
  PPH_4_2_CONSTRUCTION_MED: 2.65,   // Konstruksi menengah
  PPH_4_2_CONSTRUCTION_LARGE: 4,    // Konstruksi besar
} as const

export type PPhTypeValue = "PPH_21" | "PPH_23" | "PPH_4_2"

/** Default flat rate for a PPh type. PPh 21 returns 0 (progressive, calculated elsewhere). */
export function getDefaultRate(type: PPhTypeValue): number {
  switch (type) {
    case "PPH_23": return PPH_RATES.PPH_23_SERVICES
    case "PPH_4_2": return PPH_RATES.PPH_4_2_RENT
    case "PPH_21": return 0
  }
}

/** Calculate withholding amount and net payment. */
export function calculateWithholding(rate: number, baseAmount: number) {
  const amount = Math.round((rate / 100) * baseAmount)
  return { amount, netAmount: baseAmount - amount }
}

/**
 * Adjust rate when counterparty has no NPWP.
 * PPh 23 doubles. PPh 4(2) and PPh 21 are unaffected.
 */
export function adjustRateForNpwp(type: PPhTypeValue, rate: number, hasNpwp: boolean): number {
  if (hasNpwp) return rate
  if (type === "PPH_23") return rate * 2
  return rate
}

/** Deposit deadline: 10th of M+1. */
export function getDepositDeadline(txDate: Date): Date {
  const d = new Date(txDate)
  d.setMonth(d.getMonth() + 1)
  d.setDate(10)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Filing deadline: 20th of M+1. */
export function getFilingDeadline(txDate: Date): Date {
  const d = new Date(txDate)
  d.setMonth(d.getMonth() + 1)
  d.setDate(20)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Map PPh type to its GL liability account code. */
export function getPPhLiabilityAccount(type: PPhTypeValue): string {
  switch (type) {
    case "PPH_21": return SYS_ACCOUNTS.PPH_21_PAYABLE
    case "PPH_23": return SYS_ACCOUNTS.PPH_23_PAYABLE
    case "PPH_4_2": return SYS_ACCOUNTS.PPH_4_2_PAYABLE
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run __tests__/pph-helpers.test.ts
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add lib/pph-helpers.ts __tests__/pph-helpers.test.ts
git commit -m "feat(pph): add PPh helper functions with tests (TDD)"
```

---

## Task 4: Modify AP Payment Actions

**Files:**
- Modify: `lib/actions/finance-ap.ts` (recordVendorPayment ~line 378, recordMultiBillPayment ~line 496)

**Context:** Both functions currently post 2-line GL entries (DR AP, CR Bank). When withholding is present, they must post 3 lines (DR AP, CR Bank net, CR Utang PPh) and create a WithholdingTax record.

**Step 1: Add withholding param to recordVendorPayment**

In `lib/actions/finance-ap.ts`, add import at top:

```typescript
import { getPPhLiabilityAccount, type PPhTypeValue } from "@/lib/pph-helpers"
```

Change the `recordVendorPayment` function signature (line 378) to add `withholding` param:

```typescript
export async function recordVendorPayment(data: {
    supplierId: string
    billId?: string
    amount: number
    method?: 'CASH' | 'TRANSFER' | 'CHECK' | 'GIRO'
    reference?: string
    notes?: string
    bankAccountCode?: string
    withholding?: {
        type: PPhTypeValue
        rate: number
        baseAmount: number
        buktiPotongNo?: string
    }
})
```

**Step 2: Modify GL posting in recordVendorPayment**

Replace the GL posting block (~lines 454-472) with:

```typescript
            // Post GL entry: DR AP, CR Cash/Bank [, CR Utang PPh if withholding]
            const bankCode = getCashAccountCode(data.method || 'TRANSFER', data.bankAccountCode)
            const bankAccount = await prisma.gLAccount.findFirst({
                where: { code: bankCode },
                select: { name: true }
            })
            const bankAccountName = bankAccount?.name || 'Kas Besar'

            const pphAmount = data.withholding
                ? Math.round((data.withholding.rate / 100) * data.withholding.baseAmount)
                : 0
            const netCashAmount = data.amount - pphAmount

            const glLines: { accountCode: string; debit: number; credit: number; description: string }[] = [
                { accountCode: SYS_ACCOUNTS.AP, debit: data.amount, credit: 0, description: 'Hutang Usaha' },
                { accountCode: bankCode, debit: 0, credit: netCashAmount, description: bankAccountName },
            ]

            if (data.withholding && pphAmount > 0) {
                const pphAccountCode = getPPhLiabilityAccount(data.withholding.type)
                glLines.push({
                    accountCode: pphAccountCode,
                    debit: 0,
                    credit: pphAmount,
                    description: `PPh ${data.withholding.type.replace('PPH_', '').replace('_', '(')}${data.withholding.type === 'PPH_4_2' ? ')' : ''} - ${paymentNumber}`,
                })
            }

            const glResult = await postJournalEntry({
                description: `Vendor Payment ${paymentNumber}`,
                date: new Date(),
                reference: paymentNumber,
                lines: glLines,
            })
            if (!glResult?.success) {
                console.error("GL posting failed for vendor payment:", (glResult as any)?.error)
            }

            // Create WithholdingTax record if applicable
            if (data.withholding && pphAmount > 0) {
                await prisma.withholdingTax.create({
                    data: {
                        paymentId: payment.id,
                        invoiceId: data.billId || null,
                        type: data.withholding.type,
                        direction: 'OUT',
                        rate: data.withholding.rate,
                        baseAmount: data.withholding.baseAmount,
                        amount: pphAmount,
                        buktiPotongNo: data.withholding.buktiPotongNo || null,
                        buktiPotongDate: data.withholding.buktiPotongNo ? new Date() : null,
                    },
                })
            }
```

**Step 3: Apply same pattern to recordMultiBillPayment**

Add same `withholding` param to `recordMultiBillPayment` (line 496). The GL posting block (~lines 595-604) gets the same 3-line split. Create one WithholdingTax record for the entire payment (not per allocation — the withholding is on the total).

**Step 4: Verify build compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 5: Commit**

```bash
git add lib/actions/finance-ap.ts
git commit -m "feat(pph): add withholding tax support to AP payment actions"
```

---

## Task 5: Modify AR Payment Actions

**Files:**
- Modify: `lib/actions/finance-ar.ts` (recordARPayment ~line 783)
- Modify: `lib/actions/finance-invoices.ts` (recordInvoicePayment ~line 913)

**Context:** When a customer withholds PPh from our AR payment, we receive less cash but the full invoice is settled. The difference goes to PPh Dibayar Dimuka (prepaid tax asset, code 1340).

**Step 1: Add withheldByCustomer param to recordARPayment**

In `lib/actions/finance-ar.ts`, add imports:

```typescript
import { getPPhLiabilityAccount, type PPhTypeValue } from "@/lib/pph-helpers"
```

Change signature (~line 783):

```typescript
export async function recordARPayment(data: {
    customerId: string
    amount: number
    date?: Date
    method?: 'CASH' | 'TRANSFER' | 'CHECK' | 'CARD'
    reference?: string
    notes?: string
    invoiceId?: string
    withheldByCustomer?: {
        type: PPhTypeValue
        rate: number
        baseAmount: number
        buktiPotongNo?: string
    }
})
```

**Step 2: Modify GL posting in recordARPayment**

In the invoice payment GL posting section (~lines 846-855), replace 2-line entry with:

```typescript
                const pphAmount = data.withheldByCustomer
                    ? Math.round((data.withheldByCustomer.rate / 100) * data.withheldByCustomer.baseAmount)
                    : 0
                const totalSettled = data.amount + pphAmount

                const arLines: { accountCode: string; debit: number; credit: number; description?: string }[] = [
                    { accountCode: cashCode, debit: data.amount, credit: 0, description: `Terima dari ${customer?.name || 'Customer'}` },
                    { accountCode: SYS_ACCOUNTS.AR, debit: 0, credit: totalSettled, description: `Pelunasan ${invoice.number}` },
                ]

                if (data.withheldByCustomer && pphAmount > 0) {
                    arLines.push({
                        accountCode: SYS_ACCOUNTS.PPH_PREPAID,
                        debit: pphAmount,
                        credit: 0,
                        description: `PPh Dibayar Dimuka - ${invoice.number}`,
                    })
                }

                const glResult = await postJournalEntry({
                    description: `Penerimaan ${paymentNumber} untuk ${invoice.number}`,
                    date: data.date || new Date(),
                    reference: paymentNumber,
                    invoiceId: data.invoiceId,
                    lines: arLines,
                })
```

Also update the invoice balance logic: when customer withholds, the full invoice amount is settled (not just the cash received). Update `balanceDue` by `totalSettled`, not just `data.amount`.

After GL posting, create WithholdingTax record:

```typescript
                if (data.withheldByCustomer && pphAmount > 0) {
                    await prisma.withholdingTax.create({
                        data: {
                            paymentId: payment.id,
                            invoiceId: data.invoiceId || null,
                            type: data.withheldByCustomer.type,
                            direction: 'IN',
                            rate: data.withheldByCustomer.rate,
                            baseAmount: data.withheldByCustomer.baseAmount,
                            amount: pphAmount,
                            buktiPotongNo: data.withheldByCustomer.buktiPotongNo || null,
                            buktiPotongDate: data.withheldByCustomer.buktiPotongNo ? new Date() : null,
                        },
                    })
                }
```

**Step 3: Apply same pattern to recordInvoicePayment**

In `lib/actions/finance-invoices.ts`, add `withholding` param to `recordInvoicePayment` (~line 913):

```typescript
export async function recordInvoicePayment(data: {
    invoiceId: string
    paymentMethod: 'CASH' | 'TRANSFER' | 'CHECK' | 'CREDIT_CARD' | 'OTHER'
    amount: number
    paymentDate: Date
    reference?: string
    notes?: string
    withholding?: {
        type: PPhTypeValue
        rate: number
        baseAmount: number
        buktiPotongNo?: string
    }
})
```

Apply the same GL split logic to both the INV_OUT (AR) and INV_IN (AP) branches of this function (~lines 967-992):
- **INV_OUT (AR):** DR Bank (net), DR PPh Dibayar Dimuka (withholding), CR AR (full)
- **INV_IN (AP):** DR AP (full), CR Bank (net), CR Utang PPh (withholding)

**Step 4: Verify build**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 5: Commit**

```bash
git add lib/actions/finance-ar.ts lib/actions/finance-invoices.ts
git commit -m "feat(pph): add withholding tax support to AR payment + recordInvoicePayment"
```

---

## Task 6: PPh Server Actions

**Files:**
- Create: `lib/actions/finance-pph.ts`

**Step 1: Create finance-pph.ts with query + deposit actions**

```typescript
"use server"

import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { postJournalEntry } from "@/lib/actions/finance-gl"
import { ensureSystemAccounts, SYS_ACCOUNTS, getCashAccountCode } from "@/lib/gl-accounts"
import { assertPeriodOpen } from "@/lib/actions/finance-gl"
import { getPPhLiabilityAccount } from "@/lib/pph-helpers"

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error("Unauthorized")
  return user
}

/** List withholding tax records with filters. Read-only — uses prisma singleton. */
export async function getWithholdingTaxes(filters?: {
  type?: string
  deposited?: boolean
  startDate?: string
  endDate?: string
}) {
  try {
    await requireAuth()
    const where: any = {}

    if (filters?.type) where.type = filters.type
    if (filters?.deposited !== undefined) where.deposited = filters.deposited
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {}
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate)
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate)
    }

    const records = await prisma.withholdingTax.findMany({
      where,
      include: {
        payment: { select: { number: true, date: true } },
        invoice: { select: { number: true, supplierId: true, customerId: true, supplier: { select: { name: true } }, customer: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    })

    return { success: true, data: records }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/** Batch mark withholding taxes as deposited + post GL entry (DR Utang PPh, CR Bank). */
export async function markWithholdingDeposited(data: {
  ids: string[]
  depositDate: string
  depositRef: string
  bankAccountCode?: string
  method?: 'CASH' | 'TRANSFER'
}) {
  try {
    await requireAuth()
    await assertPeriodOpen(new Date(data.depositDate))
    await ensureSystemAccounts()

    const records = await prisma.withholdingTax.findMany({
      where: { id: { in: data.ids }, deposited: false },
    })

    if (records.length === 0) {
      return { success: false, error: "Tidak ada PPh yang perlu disetor" }
    }

    // Group by type for GL posting
    const byType = new Map<string, number>()
    for (const r of records) {
      const current = byType.get(r.type) || 0
      byType.set(r.type, current + Number(r.amount))
    }

    const bankCode = getCashAccountCode(data.method || 'TRANSFER', data.bankAccountCode)
    const totalAmount = records.reduce((sum, r) => sum + Number(r.amount), 0)

    const glLines: { accountCode: string; debit: number; credit: number; description: string }[] = []

    for (const [type, amount] of byType) {
      glLines.push({
        accountCode: getPPhLiabilityAccount(type as any),
        debit: amount,
        credit: 0,
        description: `Setor PPh ${type.replace('PPH_', '').replace('_', '(')}${type === 'PPH_4_2' ? ')' : ''}`,
      })
    }

    glLines.push({
      accountCode: bankCode,
      debit: 0,
      credit: totalAmount,
      description: `Setor pajak - ${data.depositRef}`,
    })

    const glResult = await postJournalEntry({
      description: `Penyetoran PPh - ${data.depositRef}`,
      date: new Date(data.depositDate),
      reference: data.depositRef,
      lines: glLines,
    })

    if (!glResult?.success) {
      return { success: false, error: "Gagal posting jurnal penyetoran PPh" }
    }

    // Mark records as deposited
    await prisma.withholdingTax.updateMany({
      where: { id: { in: data.ids } },
      data: {
        deposited: true,
        depositDate: new Date(data.depositDate),
        depositRef: data.depositRef,
      },
    })

    return { success: true, count: records.length, totalAmount }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/** PPh summary for a period — grouped by type + direction. */
export async function getPPhSummary(period?: { startDate: string; endDate: string }) {
  try {
    await requireAuth()

    const where: any = {}
    if (period) {
      where.createdAt = {
        gte: new Date(period.startDate),
        lte: new Date(period.endDate),
      }
    }

    const records = await prisma.withholdingTax.findMany({ where })

    const summary = {
      pph21: { total: 0, deposited: 0, outstanding: 0, count: 0 },
      pph23: { total: 0, deposited: 0, outstanding: 0, count: 0 },
      pph4_2: { total: 0, deposited: 0, outstanding: 0, count: 0 },
    }

    for (const r of records) {
      const amount = Number(r.amount)
      const key = r.type === "PPH_21" ? "pph21" : r.type === "PPH_23" ? "pph23" : "pph4_2"
      summary[key].total += amount
      summary[key].count++
      if (r.deposited) {
        summary[key].deposited += amount
      } else {
        summary[key].outstanding += amount
      }
    }

    return { success: true, data: summary }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
```

**Step 2: Verify build**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add lib/actions/finance-pph.ts
git commit -m "feat(pph): add PPh server actions (list, deposit, summary)"
```

---

## Task 7: Fix PPh 21 Payroll GL

**Files:**
- Modify: `app/actions/hcm.ts` (~line 413 `resolvePayrollAccounts`, ~line 1839 GL posting)

**Context:** Currently `resolvePayrollAccounts` does a keyword search for the tax account: `findByKeyword('LIABILITY', ['pph', 'tax', 'pajak'])`. This will match any liability with "pajak" in the name. Now that we have dedicated PPh liability accounts, it should explicitly use `SYS_ACCOUNTS.PPH_21_PAYABLE` ("2210").

**Step 1: Import SYS_ACCOUNTS in hcm.ts**

At top of `app/actions/hcm.ts`, add:

```typescript
import { SYS_ACCOUNTS } from "@/lib/gl-accounts"
```

**Step 2: Fix resolvePayrollAccounts taxAccount resolution**

In `resolvePayrollAccounts` (~line 433-435), replace:

```typescript
    const taxAccount =
        findByKeyword('LIABILITY', ['pph', 'tax', 'pajak']) ||
        accounts.find((account: any) => account.type === 'LIABILITY')
```

With:

```typescript
    const taxAccount =
        accounts.find((account: any) => account.code === SYS_ACCOUNTS.PPH_21_PAYABLE) ||
        findByKeyword('LIABILITY', ['pph', 'tax', 'pajak']) ||
        accounts.find((account: any) => account.type === 'LIABILITY')
```

This prefers the explicit `2210` account, falling back to keyword search if it doesn't exist yet.

**Step 3: Verify build**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 4: Commit**

```bash
git add app/actions/hcm.ts
git commit -m "fix(pph): payroll PPh 21 posts to Utang PPh 21 (2210) instead of generic tax account"
```

---

## Task 8: UI — Vendor Payment Dialog PPh Section

**Files:**
- Modify: `components/finance/vendor-multi-payment-dialog.tsx`

**Context:** This is the main AP payment dialog. Add a collapsible "Potong PPh" section with:
- Checkbox toggle
- PPh type dropdown (PPh 23 / PPh 4(2))
- Rate field (auto-filled from type, editable)
- DPP display (bill subtotal)
- Calculated withholding amount
- Net payment display
- Bukti Potong number field (optional)
- Warning if vendor has no NPWP

**Step 1: Read the current dialog to understand its structure**

Read `components/finance/vendor-multi-payment-dialog.tsx` fully before editing.

**Step 2: Add PPh state and UI section**

Add state variables:

```typescript
const [enablePPh, setEnablePPh] = useState(false)
const [pphType, setPPhType] = useState<"PPH_23" | "PPH_4_2">("PPH_23")
const [pphRate, setPPhRate] = useState(2)
const [buktiPotongNo, setBuktiPotongNo] = useState("")
```

Add imports:

```typescript
import { getDefaultRate, calculateWithholding, adjustRateForNpwp } from "@/lib/pph-helpers"
```

When `pphType` changes, auto-fill rate:

```typescript
useEffect(() => {
  setPPhRate(getDefaultRate(pphType))
}, [pphType])
```

Compute derived values:

```typescript
const pphBaseAmount = /* bill subtotal or total allocation DPP */
const pphCalc = enablePPh ? calculateWithholding(pphRate, pphBaseAmount) : null
```

**Step 3: Add PPh section UI after amount fields**

```tsx
{/* Potong PPh Section */}
<div className="border border-zinc-200 rounded-none p-3 space-y-3">
  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider cursor-pointer">
    <Checkbox checked={enablePPh} onCheckedChange={(v) => setEnablePPh(!!v)} />
    Potong PPh
  </label>

  {enablePPh && (
    <div className="space-y-2 pl-6">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold uppercase text-zinc-500">Jenis PPh</label>
          <Select value={pphType} onValueChange={(v) => setPPhType(v as any)}>
            <SelectTrigger className="h-8 rounded-none text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PPH_23">PPh 23</SelectItem>
              <SelectItem value="PPH_4_2">PPh 4(2)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-zinc-500">Tarif (%)</label>
          <Input
            type="number"
            step="0.01"
            value={pphRate}
            onChange={(e) => setPPhRate(Number(e.target.value))}
            className="h-8 rounded-none text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-zinc-500">DPP:</span>{" "}
          <span className="font-mono font-bold">{formatCurrency(pphBaseAmount)}</span>
        </div>
        <div>
          <span className="text-zinc-500">PPh:</span>{" "}
          <span className="font-mono font-bold text-red-600">{formatCurrency(pphCalc?.amount || 0)}</span>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold uppercase text-zinc-500">No. Bukti Potong</label>
        <Input
          value={buktiPotongNo}
          onChange={(e) => setBuktiPotongNo(e.target.value)}
          placeholder="Opsional..."
          className="h-8 rounded-none text-xs"
        />
      </div>

      <div className="bg-amber-50 border border-amber-200 p-2 text-xs">
        <span className="font-bold">Dibayar ke vendor:</span>{" "}
        <span className="font-mono font-bold text-lg">{formatCurrency(pphCalc?.netAmount || pphBaseAmount)}</span>
      </div>

      {/* NPWP warning — check supplier.npwp if available */}
    </div>
  )}
</div>
```

**Step 4: Pass withholding data to server action**

In the submit handler, pass:

```typescript
withholding: enablePPh ? {
  type: pphType,
  rate: pphRate,
  baseAmount: pphBaseAmount,
  buktiPotongNo: buktiPotongNo || undefined,
} : undefined,
```

**Step 5: Verify it renders correctly**

```bash
npm run dev
```

Visit `/finance/bills` or wherever the vendor payment dialog is triggered.

**Step 6: Commit**

```bash
git add components/finance/vendor-multi-payment-dialog.tsx
git commit -m "feat(pph): add PPh withholding section to vendor payment dialog"
```

---

## Task 9: UI — AR Payment PPh Section

**Files:**
- Modify: Whichever component renders the AR/customer payment dialog. Check `app/finance/invoices/page.tsx` or `components/finance/` for the payment dialog used for customer invoices (INV_OUT).

**Context:** Same pattern as Task 8 but for incoming payments. The checkbox label is "Dipotong PPh oleh Customer" and the summary shows "Diterima dari customer" instead of "Dibayar ke vendor".

**Step 1: Identify the AR payment dialog component**

Search for where `recordInvoicePayment` or `recordARPayment` is called from a UI component.

**Step 2: Add same PPh state + UI section**

Follow the same pattern as Task 8, adjusting labels for the AR direction.

**Step 3: Pass withheldByCustomer to server action**

```typescript
withheldByCustomer: enablePPh ? {
  type: pphType,
  rate: pphRate,
  baseAmount: pphBaseAmount,
  buktiPotongNo: buktiPotongNo || undefined,
} : undefined,
```

**Step 4: Commit**

```bash
git add <ar-payment-dialog-file>
git commit -m "feat(pph): add PPh withholding section to AR payment dialog"
```

---

## Task 10: UI — PPh Report Tab

**Files:**
- Modify: `app/finance/reports/page.tsx` (~line 89)
- Create: `hooks/use-withholding-taxes.ts`

**Step 1: Add query hook**

Create `hooks/use-withholding-taxes.ts`:

```typescript
"use client"

import { useQuery } from "@tanstack/react-query"
import { getWithholdingTaxes, getPPhSummary } from "@/lib/actions/finance-pph"
import { queryKeys } from "@/lib/query-keys"

export function useWithholdingTaxes(filters?: {
  type?: string
  deposited?: boolean
  startDate?: string
  endDate?: string
}) {
  return useQuery({
    queryKey: [...queryKeys.finance.all, "pph", filters],
    queryFn: () => getWithholdingTaxes(filters),
  })
}

export function usePPhSummary(period?: { startDate: string; endDate: string }) {
  return useQuery({
    queryKey: [...queryKeys.finance.all, "pph-summary", period],
    queryFn: () => getPPhSummary(period),
  })
}
```

**Step 2: Add "Laporan PPh" menu item**

In `app/finance/reports/page.tsx` line 89, after the `tax_report` item, add:

```typescript
{ key: "pph_report", label: "Laporan PPh (Potong/Pungut)", icon: <FileText className="h-3.5 w-3.5" /> },
```

**Step 3: Add PPh report panel**

Add a new component section in the report rendering area that renders when `reportType === "pph_report"`. The panel should include:

1. **KPI strip** — Total PPh 23 | Total PPh 4(2) | Belum Disetor | Jatuh Tempo
2. **Filter bar** — Type dropdown, period picker, deposit status
3. **Data table** — Date, Type, Vendor/Customer, DPP, Rate, Amount, Bukti Potong, Status
4. **Bulk action** — "Tandai Sudah Disetor" button that opens a small dialog for deposit date + NTPN/SSP reference
5. **Deadline reminder** — Shows "Batas setor: 10th M+1 | Batas lapor: 20th M+1"

Follow existing report tab patterns in the file for layout consistency.

**Step 4: Verify it renders**

```bash
npm run dev
```

Visit `/finance/reports`, select "Laporan PPh" from sidebar.

**Step 5: Commit**

```bash
git add hooks/use-withholding-taxes.ts app/finance/reports/page.tsx lib/query-keys.ts
git commit -m "feat(pph): add PPh report tab in finance reports"
```

---

## Task 11: Integration Tests + Final Verification

**Files:**
- Create: `__tests__/pph-integration.test.ts`

**Step 1: Write integration tests for GL line construction**

Test that the GL line arrays are constructed correctly (without hitting DB). Extract the GL line construction logic into testable helpers if needed, or test the helper output:

```typescript
import { describe, it, expect } from "vitest"
import { calculateWithholding, getPPhLiabilityAccount } from "@/lib/pph-helpers"
import { SYS_ACCOUNTS } from "@/lib/gl-accounts"

describe("PPh GL line construction", () => {
  it("AP payment with PPh 23: 3 lines, balanced", () => {
    const billAmount = 20_000_000
    const { amount: pphAmount, netAmount } = calculateWithholding(2, billAmount)
    const pphAccount = getPPhLiabilityAccount("PPH_23")

    const lines = [
      { accountCode: SYS_ACCOUNTS.AP, debit: billAmount, credit: 0 },
      { accountCode: SYS_ACCOUNTS.BANK_BCA, debit: 0, credit: netAmount },
      { accountCode: pphAccount, debit: 0, credit: pphAmount },
    ]

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
    expect(totalDebit).toBe(totalCredit)
    expect(totalDebit).toBe(20_000_000)
    expect(pphAccount).toBe("2220")
  })

  it("AR payment with PPh 23 withheld: 3 lines, balanced", () => {
    const invoiceAmount = 20_000_000
    const { amount: pphAmount } = calculateWithholding(2, invoiceAmount)
    const netReceived = invoiceAmount - pphAmount

    const lines = [
      { accountCode: SYS_ACCOUNTS.BANK_BCA, debit: netReceived, credit: 0 },
      { accountCode: SYS_ACCOUNTS.PPH_PREPAID, debit: pphAmount, credit: 0 },
      { accountCode: SYS_ACCOUNTS.AR, debit: 0, credit: invoiceAmount },
    ]

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
    expect(totalDebit).toBe(totalCredit)
    expect(totalDebit).toBe(20_000_000)
  })

  it("PPh deposit: 2 lines, balanced", () => {
    const depositAmount = 400_000
    const pphAccount = getPPhLiabilityAccount("PPH_23")

    const lines = [
      { accountCode: pphAccount, debit: depositAmount, credit: 0 },
      { accountCode: SYS_ACCOUNTS.BANK_BCA, debit: 0, credit: depositAmount },
    ]

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
    expect(totalDebit).toBe(totalCredit)
  })
})
```

**Step 2: Run all tests**

```bash
npx vitest run
```

Expected: All existing tests still pass + new PPh tests pass.

**Step 3: Run type check + lint**

```bash
npx tsc --noEmit && npm run lint
```

**Step 4: Commit**

```bash
git add __tests__/pph-integration.test.ts
git commit -m "test(pph): add PPh GL line construction integration tests"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `npx vitest run` — all tests pass
- [ ] `npx tsc --noEmit` — no type errors
- [ ] `npm run lint` — clean
- [ ] Manual: create a vendor bill, pay it with PPh 23 2% → GL shows 3-line entry
- [ ] Manual: receive AR payment with customer PPh 23 → GL shows PPh Dibayar Dimuka
- [ ] Manual: check PPh report tab → shows both records
- [ ] Manual: mark as deposited → GL shows deposit entry
- [ ] Manual: run payroll → PPh 21 posts to account 2210 (not 7900)

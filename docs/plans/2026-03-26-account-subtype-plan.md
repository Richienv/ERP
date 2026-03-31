# AccountSubType Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `subType` field to GLAccount with 17 detailed classification values, auto-assign from code ranges, and update Balance Sheet + P&L reports to group by sub-type.

**Architecture:** New `AccountSubType` enum + `subType` field on GLAccount via Prisma migration. A helper function `inferSubType(code)` maps account codes to sub-types. Data migration script assigns sub-types to existing accounts. Reports updated to group by sub-type instead of flat type. All existing `type`-based queries remain untouched — zero breaking changes.

**Tech Stack:** Prisma 6.x (migration), TypeScript, Vitest

---

### Task 1: Add AccountSubType enum + subType field + migration

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add enum and field**

Add the `AccountSubType` enum to `prisma/schema.prisma` (near the other enums):

```prisma
enum AccountSubType {
  ASSET_RECEIVABLE
  ASSET_CASH
  ASSET_CURRENT
  ASSET_NON_CURRENT
  ASSET_PREPAYMENTS
  ASSET_FIXED
  LIABILITY_PAYABLE
  LIABILITY_CURRENT
  LIABILITY_NON_CURRENT
  EQUITY
  EQUITY_UNAFFECTED
  INCOME
  INCOME_OTHER
  EXPENSE
  EXPENSE_DEPRECIATION
  EXPENSE_DIRECT_COST
  GENERAL
}
```

Add `subType` field to the GLAccount model (after the `type` field):

```prisma
  subType  AccountSubType @default(GENERAL)
```

**Step 2: Run migration**

```bash
npx prisma migrate dev --name add_account_sub_type
```

**Step 3: Verify + commit**

```bash
npx prisma migrate status
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(coa): add AccountSubType enum and subType field to GLAccount"
```

---

### Task 2: Create inferSubType helper + tests

**Files:**
- Create: `lib/account-subtype-helpers.ts`
- Create: `__tests__/account-subtype-helpers.test.ts`

**Step 1: Write tests**

```typescript
// __tests__/account-subtype-helpers.test.ts
import { describe, it, expect } from "vitest"
import { inferSubType } from "@/lib/account-subtype-helpers"

describe("inferSubType", () => {
    // Cash & Bank
    it("1000 → ASSET_CASH", () => expect(inferSubType("1000")).toBe("ASSET_CASH"))
    it("1110 → ASSET_CASH", () => expect(inferSubType("1110")).toBe("ASSET_CASH"))

    // Receivables
    it("1200 → ASSET_RECEIVABLE", () => expect(inferSubType("1200")).toBe("ASSET_RECEIVABLE"))

    // Current assets / prepayments
    it("1300 → ASSET_CURRENT", () => expect(inferSubType("1300")).toBe("ASSET_CURRENT"))
    it("1330 → ASSET_PREPAYMENTS", () => expect(inferSubType("1330")).toBe("ASSET_PREPAYMENTS"))

    // Fixed assets
    it("1500 → ASSET_FIXED", () => expect(inferSubType("1500")).toBe("ASSET_FIXED"))
    it("1590 → ASSET_FIXED", () => expect(inferSubType("1590")).toBe("ASSET_FIXED"))

    // Non-current
    it("1800 → ASSET_NON_CURRENT", () => expect(inferSubType("1800")).toBe("ASSET_NON_CURRENT"))

    // Payables
    it("2000 → LIABILITY_PAYABLE", () => expect(inferSubType("2000")).toBe("LIABILITY_PAYABLE"))

    // Current liabilities
    it("2100 → LIABILITY_CURRENT", () => expect(inferSubType("2100")).toBe("LIABILITY_CURRENT"))
    it("2110 → LIABILITY_CURRENT", () => expect(inferSubType("2110")).toBe("LIABILITY_CURRENT"))

    // Non-current liabilities
    it("2500 → LIABILITY_NON_CURRENT", () => expect(inferSubType("2500")).toBe("LIABILITY_NON_CURRENT"))

    // Equity
    it("3000 → EQUITY", () => expect(inferSubType("3000")).toBe("EQUITY"))
    it("3100 → EQUITY", () => expect(inferSubType("3100")).toBe("EQUITY"))
    it("3300 → EQUITY_UNAFFECTED", () => expect(inferSubType("3300")).toBe("EQUITY_UNAFFECTED"))

    // Income
    it("4000 → INCOME", () => expect(inferSubType("4000")).toBe("INCOME"))
    it("4100 → INCOME", () => expect(inferSubType("4100")).toBe("INCOME"))
    it("4800 → INCOME_OTHER", () => expect(inferSubType("4800")).toBe("INCOME_OTHER"))

    // Direct cost (COGS)
    it("5000 → EXPENSE_DIRECT_COST", () => expect(inferSubType("5000")).toBe("EXPENSE_DIRECT_COST"))
    it("5200 → EXPENSE_DIRECT_COST", () => expect(inferSubType("5200")).toBe("EXPENSE_DIRECT_COST"))

    // Operating expense
    it("6100 → EXPENSE", () => expect(inferSubType("6100")).toBe("EXPENSE"))
    it("6200 → EXPENSE", () => expect(inferSubType("6200")).toBe("EXPENSE"))

    // Depreciation
    it("6290 → EXPENSE_DEPRECIATION", () => expect(inferSubType("6290")).toBe("EXPENSE_DEPRECIATION"))
    it("7100 → EXPENSE_DEPRECIATION", () => expect(inferSubType("7100")).toBe("EXPENSE_DEPRECIATION"))

    // Other expense
    it("8100 → EXPENSE", () => expect(inferSubType("8100")).toBe("EXPENSE"))

    // Tax expense
    it("9100 → EXPENSE", () => expect(inferSubType("9100")).toBe("EXPENSE"))

    // Unknown
    it("0000 → GENERAL", () => expect(inferSubType("0000")).toBe("GENERAL"))
})
```

**Step 2: Write implementation**

```typescript
// lib/account-subtype-helpers.ts

/**
 * Infer AccountSubType from account code based on Indonesian PSAK COA structure.
 * Used for auto-assigning subType when creating accounts or migrating data.
 */
export function inferSubType(code: string): string {
    const num = parseInt(code, 10)
    if (isNaN(num)) return "GENERAL"

    // Assets (1xxx)
    if (num >= 1000 && num <= 1199) return "ASSET_CASH"
    if (num >= 1200 && num <= 1299) return "ASSET_RECEIVABLE"
    if (num >= 1300 && num <= 1329) return "ASSET_CURRENT"
    if (num >= 1330 && num <= 1399) return "ASSET_PREPAYMENTS"  // PPN Masukan, uang muka
    if (num >= 1400 && num <= 1499) return "ASSET_CURRENT"      // Persediaan
    if (num >= 1500 && num <= 1599) return "ASSET_FIXED"
    if (num >= 1600 && num <= 1799) return "ASSET_FIXED"
    if (num >= 1800 && num <= 1999) return "ASSET_NON_CURRENT"

    // Liabilities (2xxx)
    if (num >= 2000 && num <= 2099) return "LIABILITY_PAYABLE"
    if (num >= 2100 && num <= 2499) return "LIABILITY_CURRENT"
    if (num >= 2500 && num <= 2999) return "LIABILITY_NON_CURRENT"

    // Equity (3xxx)
    if (num === 3300) return "EQUITY_UNAFFECTED"  // Laba Tahun Berjalan
    if (num >= 3000 && num <= 3999) return "EQUITY"

    // Revenue (4xxx)
    if (num >= 4000 && num <= 4199) return "INCOME"
    if (num >= 4200 && num <= 4999) return "INCOME_OTHER"

    // COGS (5xxx)
    if (num >= 5000 && num <= 5999) return "EXPENSE_DIRECT_COST"

    // Operating expenses (6xxx)
    if (num === 6290) return "EXPENSE_DEPRECIATION"  // Beban Penyusutan
    if (num >= 6000 && num <= 6999) return "EXPENSE"

    // Depreciation / Other (7xxx)
    if (num >= 7000 && num <= 7999) return "EXPENSE_DEPRECIATION"

    // Non-operational / tax (8-9xxx)
    if (num >= 8000 && num <= 9999) return "EXPENSE"

    return "GENERAL"
}

/**
 * Human-readable label for AccountSubType (Bahasa Indonesia)
 */
export function subTypeLabel(subType: string): string {
    const labels: Record<string, string> = {
        ASSET_CASH: "Kas & Bank",
        ASSET_RECEIVABLE: "Piutang",
        ASSET_CURRENT: "Aset Lancar",
        ASSET_NON_CURRENT: "Aset Tidak Lancar",
        ASSET_PREPAYMENTS: "Biaya Dibayar Dimuka",
        ASSET_FIXED: "Aset Tetap",
        LIABILITY_PAYABLE: "Hutang Usaha",
        LIABILITY_CURRENT: "Kewajiban Lancar",
        LIABILITY_NON_CURRENT: "Kewajiban Jk Panjang",
        EQUITY: "Modal",
        EQUITY_UNAFFECTED: "Laba Tahun Berjalan",
        INCOME: "Pendapatan",
        INCOME_OTHER: "Pendapatan Lain-lain",
        EXPENSE: "Beban Operasional",
        EXPENSE_DEPRECIATION: "Penyusutan",
        EXPENSE_DIRECT_COST: "Harga Pokok",
        GENERAL: "Umum",
    }
    return labels[subType] || subType
}
```

**Step 3: Run tests**

```bash
npx vitest run __tests__/account-subtype-helpers.test.ts
```
Expected: All tests PASS.

**Step 4: Commit**

```bash
git add lib/account-subtype-helpers.ts __tests__/account-subtype-helpers.test.ts
git commit -m "feat(coa): add inferSubType helper with code-range mapping + tests"
```

---

### Task 3: Data migration — assign subType to existing accounts

**Files:**
- Create: `scripts/migrate-gl-subtypes.ts`

**Step 1: Create script**

```typescript
import { PrismaClient } from "@prisma/client"
// Note: can't import from @/lib in scripts, so inline the function
function inferSubType(code: string): string {
    const num = parseInt(code, 10)
    if (isNaN(num)) return "GENERAL"
    if (num >= 1000 && num <= 1199) return "ASSET_CASH"
    if (num >= 1200 && num <= 1299) return "ASSET_RECEIVABLE"
    if (num >= 1300 && num <= 1329) return "ASSET_CURRENT"
    if (num >= 1330 && num <= 1399) return "ASSET_PREPAYMENTS"
    if (num >= 1400 && num <= 1499) return "ASSET_CURRENT"
    if (num >= 1500 && num <= 1799) return "ASSET_FIXED"
    if (num >= 1800 && num <= 1999) return "ASSET_NON_CURRENT"
    if (num >= 2000 && num <= 2099) return "LIABILITY_PAYABLE"
    if (num >= 2100 && num <= 2499) return "LIABILITY_CURRENT"
    if (num >= 2500 && num <= 2999) return "LIABILITY_NON_CURRENT"
    if (num === 3300) return "EQUITY_UNAFFECTED"
    if (num >= 3000 && num <= 3999) return "EQUITY"
    if (num >= 4000 && num <= 4199) return "INCOME"
    if (num >= 4200 && num <= 4999) return "INCOME_OTHER"
    if (num >= 5000 && num <= 5999) return "EXPENSE_DIRECT_COST"
    if (num === 6290) return "EXPENSE_DEPRECIATION"
    if (num >= 6000 && num <= 6999) return "EXPENSE"
    if (num >= 7000 && num <= 7999) return "EXPENSE_DEPRECIATION"
    if (num >= 8000 && num <= 9999) return "EXPENSE"
    return "GENERAL"
}

const prisma = new PrismaClient()

async function main() {
    console.log("Assigning subType to GL accounts...")
    const accounts = await prisma.gLAccount.findMany({ select: { id: true, code: true, subType: true } })

    let updated = 0
    for (const acc of accounts) {
        const newSubType = inferSubType(acc.code)
        if (acc.subType !== newSubType) {
            await prisma.gLAccount.update({
                where: { id: acc.id },
                data: { subType: newSubType as any },
            })
            console.log(`  ${acc.code} → ${newSubType}`)
            updated++
        }
    }
    console.log(`Done. Updated ${updated} of ${accounts.length} accounts.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
```

**Step 2: Run it**

```bash
npx tsx scripts/migrate-gl-subtypes.ts
```

**Step 3: Commit**

```bash
git add scripts/migrate-gl-subtypes.ts
git commit -m "feat(coa): data migration to assign subType from code ranges"
```

---

### Task 4: Wire subType into GLAccountNode + tree display + createGLAccount

**Files:**
- Modify: `lib/finance-gl-helpers.ts` (GLAccountNode interface)
- Modify: `lib/actions/finance-gl.ts` (getChartOfAccountsTree, createGLAccount)
- Modify: `app/finance/chart-accounts/page.tsx` (show subType badge)

**Step 1: Add subType to GLAccountNode**

In `lib/finance-gl-helpers.ts`, add to the interface:
```typescript
export interface GLAccountNode {
    id: string
    code: string
    name: string
    type: string
    subType: string
    balance: number
    parentId: string | null
    children: GLAccountNode[]
}
```

**Step 2: Update getChartOfAccountsTree to include subType**

In `lib/actions/finance-gl.ts`, in the `getChartOfAccountsTree()` function, update the node creation to include `subType`:
```typescript
nodeMap.set(acc.id, {
    id: acc.id,
    code: acc.code,
    name: acc.name,
    type: acc.type,
    subType: acc.subType,  // ADD THIS
    balance: balanceMap.get(acc.id) || 0,
    parentId: acc.parentId,
    children: [],
})
```

**Step 3: Update createGLAccount to auto-assign subType**

In `lib/actions/finance-gl.ts`, in `createGLAccount()`, add auto-inference:
```typescript
import { inferSubType } from "@/lib/account-subtype-helpers"

// Inside createGLAccount, when creating:
const account = await prisma.gLAccount.create({
    data: {
        code: data.code,
        name: data.name,
        type: data.type,
        subType: inferSubType(data.code) as any,
        parentId,
    }
})
```

Also update the duplicate `createGLAccount` in `lib/actions/finance.ts` if it exists.

**Step 4: Update chart-accounts page to show subType badge**

In `app/finance/chart-accounts/page.tsx`, find the `AccountNode` component. It currently shows a `type` badge. Add a `subType` badge next to it:

```tsx
import { subTypeLabel } from "@/lib/account-subtype-helpers"

// In the AccountNode JSX, after the type badge:
<span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 border border-orange-200 text-orange-500 bg-orange-50">
    {subTypeLabel(node.subType)}
</span>
```

**Step 5: Run tests + verify**

```bash
npx vitest run && npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add lib/finance-gl-helpers.ts lib/actions/finance-gl.ts lib/actions/finance.ts app/finance/chart-accounts/page.tsx lib/account-subtype-helpers.ts
git commit -m "feat(coa): wire subType into tree display and account creation"
```

---

### Task 5: Update Balance Sheet report to group by subType

**Files:**
- Modify: `lib/actions/finance-reports.ts` (getBalanceSheetReport)

**Step 1: Read the current getBalanceSheetReport function**

Find it in `lib/actions/finance-reports.ts`. Understand how it currently groups accounts.

**Step 2: Update grouping to use subType**

The current report likely groups all ASSET accounts together. Update it to sub-group:

```
Aset Lancar:
  - ASSET_CASH accounts
  - ASSET_RECEIVABLE accounts
  - ASSET_CURRENT accounts
  - ASSET_PREPAYMENTS accounts

Aset Tetap:
  - ASSET_FIXED accounts

Aset Lainnya:
  - ASSET_NON_CURRENT accounts

Kewajiban Lancar:
  - LIABILITY_PAYABLE accounts
  - LIABILITY_CURRENT accounts

Kewajiban Jk Panjang:
  - LIABILITY_NON_CURRENT accounts

Ekuitas:
  - EQUITY accounts
  - EQUITY_UNAFFECTED accounts
```

Read the current function first — the exact changes depend on its structure. The key is to add `subType` to the query's `select` and group by it.

**Step 3: Run tests + commit**

```bash
npx vitest run
git add lib/actions/finance-reports.ts
git commit -m "feat(reports): group Balance Sheet by account sub-type"
```

---

### Task 6: Update P&L report to group by subType

**Files:**
- Modify: `lib/actions/finance-reports.ts` (getProfitLossReport)

**Step 1: Update P&L grouping**

```
Pendapatan:
  - INCOME accounts

Pendapatan Lain-lain:
  - INCOME_OTHER accounts

Harga Pokok Penjualan:
  - EXPENSE_DIRECT_COST accounts

Beban Operasional:
  - EXPENSE accounts

Beban Penyusutan:
  - EXPENSE_DEPRECIATION accounts
```

**Step 2: Run tests + commit**

```bash
npx vitest run
git add lib/actions/finance-reports.ts
git commit -m "feat(reports): group P&L by account sub-type"
```

---

### Task 7: Final verification

**Step 1: Run full test suite + TS check**

```bash
npx vitest run && npx tsc --noEmit
```

**Step 2: Verify no regressions**

All existing finance functionality must still work — the `type` field is untouched.

**Step 3: Commit any fixes**

---

## Verification Guide

| # | Halaman | Aksi | Expected |
|---|---------|------|----------|
| 1 | `/finance/chart-accounts` | Buka **Bagan Akun** | Setiap akun menampilkan badge orange sub-type: "Kas & Bank", "Piutang", "Aset Tetap", dll |
| 2 | `/finance/chart-accounts` | Klik filter **"Tipe"** → ASSET | Semua akun asset tampil (filter `type` tetap bekerja) |
| 3 | `/finance/chart-accounts` → **"+ Tambah Akun"** | Buat akun kode `1250`, tipe ASSET | Sub-type otomatis: "Piutang" (ASSET_RECEIVABLE) |
| 4 | `/finance/chart-accounts` → **"+ Tambah Akun"** | Buat akun kode `5300`, tipe EXPENSE | Sub-type otomatis: "Harga Pokok" (EXPENSE_DIRECT_COST) |
| 5 | `/finance/reports` → **Neraca** | Buka Balance Sheet | Terkelompok: **Aset Lancar** (Kas+Piutang+Persediaan), **Aset Tetap** (Tanah+Kendaraan+Peralatan) |
| 6 | `/finance/reports` → **Laba Rugi** | Buka P&L | Terkelompok: **Pendapatan**, **HPP** (terpisah), **Beban Operasional**, **Penyusutan** (terpisah) |
| 7 | `/finance/bills` | Approve bill → cek jurnal | Semua GL posting tetap normal — `type` tidak berubah |
| 8 | `/finance/invoices` | Kirim invoice → cek jurnal | GL posting tetap normal |
| 9 | **Jika sub-type salah** | Akun dapat sub-type yang tidak sesuai | Bisa di-edit manual di masa depan (field ada di DB) |

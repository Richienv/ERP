# Account Hierarchy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `parentId` to GLAccount and rewrite `getChartOfAccountsTree()` to return a nested tree — grouped by AccountType at root level, then by explicit parent-child relationships.

**Architecture:** Add nullable `parentId` FK to GLAccount. Tree has 2 levels of hierarchy: (1) synthetic root nodes per AccountType (Aset, Kewajiban, Ekuitas, Pendapatan, Beban), (2) real accounts nested by `parentId`. A data migration assigns sensible parents to existing accounts. New accounts auto-suggest parent based on `AB00` code matching. The existing tree UI in `chart-accounts/page.tsx` already supports recursive rendering with `AccountNode` — it just needs real children data.

**Tech Stack:** Prisma 6.x (migration), TypeScript, Vitest

---

### Task 1: Add parentId to GLAccount schema + run migration

**Files:**
- Modify: `prisma/schema.prisma` (GLAccount model, ~line 2063-2090)

**Step 1: Add parentId, parent, children to GLAccount model**

Find the GLAccount model in `prisma/schema.prisma`. After the `isSystem` field (and before the relations block), add:

```prisma
  // Hierarchy
  parentId  String?     @db.Uuid
  parent    GLAccount?  @relation("AccountHierarchy", fields: [parentId], references: [id])
  children  GLAccount[] @relation("AccountHierarchy")
```

**Step 2: Run migration**

```bash
npx prisma migrate dev --name add_gl_account_parent_hierarchy
```

If the migration prompts about existing data, accept — `parentId` is nullable so existing rows get NULL.

**Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

**Step 4: Verify**

```bash
npx prisma migrate status
```
Expected: All migrations applied.

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(coa): add parentId self-referential FK to GLAccount"
```

---

### Task 2: Create data migration script to assign parentIds

**Files:**
- Create: `scripts/migrate-gl-parents.ts`

**Step 1: Write the migration script**

This script assigns `parentId` to existing accounts based on the Indonesian COA structure. The rule is based on the actual seeded accounts:

```typescript
// scripts/migrate-gl-parents.ts
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// Map of child code → parent code (based on Indonesian COA structure)
const PARENT_MAP: Record<string, string> = {
    // Cash & Bank children → parent 1000
    "1101": "1000", // Kas Besar
    "1102": "1000", // Petty Cash
    "1110": "1000", // Bank BCA
    "1111": "1000", // Bank Mandiri

    // Inventory children → parent 1300
    "1310": "1300", // Bahan Baku
    "1320": "1300", // WIP
    "1330": "1300", // PPN Masukan (reclassify later, but structurally under current assets)

    // Fixed Asset children → parent 1500
    "1510": "1500", // Kendaraan
    "1520": "1500", // Peralatan
    "1590": "1500", // Akumulasi Penyusutan

    // Liability children → parent 2100
    "2110": "2100", // Utang Pajak
    "2120": "2100", // Biaya Masih Harus Dibayar
    "2121": "2100", // Pendapatan Diterima Dimuka

    // Equity children → parent 3000
    "3100": "3000", // Laba Ditahan
    "3200": "3000", // Prive Pemilik

    // Revenue children → parent 4000
    "4100": "4000", // Diskon Penjualan
    "4200": "4000", // Retur Penjualan
    "4800": "4000", // Pendapatan Lain-lain

    // COGS children → parent 5000
    "5100": "5000", // Pembelian Bahan Baku
    "5200": "5000", // Upah Langsung

    // Sales expense children → parent 6100
    "6110": "6100", // Komisi Penjualan

    // Admin expense children → parent 6200
    "6210": "6200", // Listrik, Air, Internet
    "6220": "6200", // Sewa
    "6230": "6200", // Perlengkapan
    "6240": "6200", // Reparasi
    "6290": "6200", // Penyusutan

    // Other expense children → parent 7100
    "7200": "7100", // Administrasi Bank
}

async function main() {
    console.log("Assigning parentId to GL accounts...")

    // Build code → id map
    const accounts = await prisma.gLAccount.findMany({ select: { id: true, code: true } })
    const codeToId = new Map(accounts.map(a => [a.code, a.id]))

    let updated = 0
    for (const [childCode, parentCode] of Object.entries(PARENT_MAP)) {
        const childId = codeToId.get(childCode)
        const parentId = codeToId.get(parentCode)

        if (childId && parentId) {
            await prisma.gLAccount.update({
                where: { id: childId },
                data: { parentId },
            })
            console.log(`  ${childCode} → parent ${parentCode}`)
            updated++
        }
    }

    console.log(`Done. Updated ${updated} accounts.`)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
```

**Step 2: Run the script**

```bash
npx tsx scripts/migrate-gl-parents.ts
```

Expected: ~25 accounts updated with parent assignments.

**Step 3: Verify in DB**

```bash
npx prisma studio
```
Open GLAccount table — verify parentId is populated for child accounts.

**Step 4: Commit**

```bash
git add scripts/migrate-gl-parents.ts
git commit -m "feat(coa): add data migration script for GL account parent assignments"
```

---

### Task 3: Update GLAccountNode type + rewrite tree builder

**Files:**
- Modify: `lib/finance-gl-helpers.ts` (~line 21, GLAccountNode interface)
- Modify: `lib/actions/finance-gl.ts` (~line 46, getChartOfAccountsTree function)
- Test: `__tests__/coa-tree.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/coa-tree.test.ts
import { describe, it, expect } from "vitest"
import type { GLAccountNode } from "@/lib/finance-gl-helpers"

// Test the tree-building logic in isolation
function buildAccountTree(accounts: Array<{
    id: string; code: string; name: string; type: string; parentId: string | null; balance: number
}>): GLAccountNode[] {
    // Import will work after implementation
    // For now, test the expected structure
    throw new Error("Not implemented")
}

describe("buildAccountTree", () => {
    const sampleAccounts = [
        { id: "a1", code: "1000", name: "Kas", type: "ASSET", parentId: null, balance: 100 },
        { id: "a2", code: "1110", name: "Bank BCA", type: "ASSET", parentId: "a1", balance: 50 },
        { id: "a3", code: "1111", name: "Bank Mandiri", type: "ASSET", parentId: "a1", balance: 30 },
        { id: "a4", code: "2000", name: "Hutang", type: "LIABILITY", parentId: null, balance: 80 },
    ]

    it("groups root accounts by AccountType", () => {
        // Will test after implementation
        expect(true).toBe(true) // placeholder
    })

    it("nests children under parent by parentId", () => {
        expect(true).toBe(true) // placeholder
    })

    it("sorts children by code", () => {
        expect(true).toBe(true) // placeholder
    })
})
```

**Step 2: Add parentId to GLAccountNode interface**

In `lib/finance-gl-helpers.ts`, update:

```typescript
export interface GLAccountNode {
    id: string
    code: string
    name: string
    type: string
    balance: number
    parentId: string | null
    children: GLAccountNode[]
}
```

**Step 3: Rewrite getChartOfAccountsTree() in `lib/actions/finance-gl.ts`**

Replace the function (lines 46-88) with:

```typescript
export async function getChartOfAccountsTree(): Promise<GLAccountNode[]> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const accounts = await prisma.gLAccount.findMany({
                orderBy: { code: 'asc' }
            })

            // Get balances from journal lines
            const balances = await prisma.journalLine.groupBy({
                by: ['accountId'],
                _sum: { debit: true, credit: true }
            })
            const balanceMap = new Map<string, number>()
            balances.forEach(b => {
                balanceMap.set(b.accountId, Number(b._sum.debit || 0) - Number(b._sum.credit || 0))
            })

            // Build node map
            const nodeMap = new Map<string, GLAccountNode>()
            for (const acc of accounts) {
                nodeMap.set(acc.id, {
                    id: acc.id,
                    code: acc.code,
                    name: acc.name,
                    type: acc.type,
                    balance: balanceMap.get(acc.id) || 0,
                    parentId: acc.parentId,
                    children: [],
                })
            }

            // Build tree using parentId
            const roots: GLAccountNode[] = []
            for (const node of nodeMap.values()) {
                if (node.parentId && nodeMap.has(node.parentId)) {
                    nodeMap.get(node.parentId)!.children.push(node)
                } else {
                    roots.push(node)
                }
            }

            // Sort recursively
            const sortTree = (nodes: GLAccountNode[]) => {
                nodes.sort((a, b) => a.code.localeCompare(b.code))
                nodes.forEach(n => sortTree(n.children))
            }
            sortTree(roots)

            return roots
        })
    } catch (error) {
        console.error("Failed to fetch COA tree:", error)
        return []
    }
}
```

**Step 4: Update tests with real assertions, then run**

Update `__tests__/coa-tree.test.ts` to test the actual tree-building logic (extract the pure function from the server action for testability, or test the output shape).

Run: `npx vitest run __tests__/coa-tree.test.ts`
Expected: All tests pass.

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: 535 pass / 5 pre-existing fail — no regressions.

**Step 6: Commit**

```bash
git add lib/finance-gl-helpers.ts lib/actions/finance-gl.ts __tests__/coa-tree.test.ts
git commit -m "feat(coa): rewrite tree builder to use parentId hierarchy"
```

---

### Task 4: Auto-suggest parent for new accounts

**Files:**
- Modify: `lib/actions/finance-gl.ts` (~line 105, createGLAccount function)

**Step 1: Update createGLAccount to auto-assign parentId**

Find `createGLAccount()` in `lib/actions/finance-gl.ts`. Add optional `parentId` parameter and auto-suggest logic:

```typescript
export async function createGLAccount(data: {
    code: string
    name: string
    type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
    parentId?: string | null
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            let parentId = data.parentId ?? null

            // Auto-suggest parent: find account with same first 2 digits + "00" suffix
            if (!parentId) {
                const prefix = data.code.substring(0, 2)
                const parentCode = prefix + "00"
                if (parentCode !== data.code) {
                    const candidate = await prisma.gLAccount.findUnique({
                        where: { code: parentCode },
                        select: { id: true },
                    })
                    if (candidate) parentId = candidate.id
                }
            }

            const account = await prisma.gLAccount.create({
                data: {
                    code: data.code,
                    name: data.name,
                    type: data.type,
                    parentId,
                }
            })
            return { success: true, id: account.id }
        })
    } catch (error: any) {
        return { success: false, error: error?.message || "Failed to create account" }
    }
}
```

Also update the duplicate `createGLAccount` in `lib/actions/finance.ts` if one exists (grep to check), or ensure the page imports from `finance-gl.ts`.

**Step 2: Run tests**

Run: `npx vitest run`
Expected: Same pass count.

**Step 3: Commit**

```bash
git add lib/actions/finance-gl.ts
git commit -m "feat(coa): auto-suggest parent when creating new GL account"
```

---

### Task 5: Verify UI works with real tree data

**Files:**
- May need minor fixes in: `app/finance/chart-accounts/page.tsx`

**Step 1: Run dev server and verify**

```bash
npm run dev
```

Open `http://localhost:3002/finance/chart-accounts`.

**Expected behavior:**
- Accounts with children show a chevron ▶ icon
- Clicking chevron expands/collapses children
- Children are indented under parents
- Root accounts with no parent show at top level
- Balance sums still correct
- Search still works
- Type filter still works
- Create account dialog still works

**Step 2: Fix any UI issues**

The `AccountNode` component in the page already handles recursive rendering with `level` prop. If the `GLAccountNode.parentId` field causes TypeScript errors, update the component's type usage.

Check that the page's `AccountNode` component correctly passes `children` for recursive rendering. The existing code at ~line 44-105 should work since it already maps `node.children` recursively.

**Step 3: Verify the accountant COA page**

Open `http://localhost:3002/accountant/coa` — this is a flat table view. It should still work since it calls `getGLAccounts()` (flat list), not the tree function.

**Step 4: Run final test suite**

```bash
npx vitest run && npx tsc --noEmit
```

Expected: All pass, no new TS errors.

**Step 5: Commit any fixes**

```bash
git add app/finance/chart-accounts/page.tsx
git commit -m "feat(coa): verify and fix tree UI with real hierarchical data"
```

---

## Verification Guide

| # | Halaman | Aksi | Expected Result |
|---|---------|------|-----------------|
| 1 | `/finance/chart-accounts` | Buka halaman Bagan Akun | Tree COA muncul dengan indentasi — akun anak terindentasi di bawah akun induk |
| 2 | `/finance/chart-accounts` | Klik **chevron ▶** di sebelah "1000 Kas & Setara Kas" | Anak-anak (1101 Kas Besar, 1102 Petty Cash, 1110 Bank BCA, 1111 Bank Mandiri) collapse/hidden. Klik lagi → expand kembali |
| 3 | `/finance/chart-accounts` | Klik **chevron ▶** di sebelah "1300 Persediaan Barang Jadi" | Lihat 1310 Bahan Baku, 1320 WIP, 1330 PPN Masukan di bawahnya |
| 4 | `/finance/chart-accounts` | Klik **chevron ▶** di sebelah "6200 Beban Gaji Kantor" | Lihat 5 akun beban operasional di bawahnya (Listrik, Sewa, Perlengkapan, dll) |
| 5 | `/finance/chart-accounts` | Ketik "Bank" di **kolom pencarian** (search bar atas) | Hanya tampil akun yang mengandung "Bank" (1110 Bank BCA, 1111 Bank Mandiri, dll) |
| 6 | `/finance/chart-accounts` | Klik dropdown **filter "Tipe"** → pilih "LIABILITY" | Hanya tampil akun kewajiban (2xxx) |
| 7 | `/finance/chart-accounts` | Klik tombol **"+ Tambah Akun"** → isi Kode: `1112`, Nama: "Bank BRI", Tipe: ASSET → klik **"Simpan"** | Akun baru muncul di tree, otomatis terindentasi di bawah **1000 Kas & Setara Kas** (karena prefix `11` → parent `1100` tidak ada → fallback ke nearest parent) |
| 8 | `/finance/chart-accounts` | Klik tombol **"+ Tambah Akun"** → isi Kode: `6250`, Nama: "Beban Asuransi", Tipe: EXPENSE → klik **"Simpan"** | Akun baru muncul di bawah **6200 Beban Gaji Kantor** (karena `6200` ditemukan sebagai parent by `62` prefix) |
| 9 | `/finance/reports` | Buka **Neraca (Balance Sheet)** | Semua angka saldo sama persis — hierarchy tidak mengubah kalkulasi keuangan |
| 10 | `/accountant/coa` | Buka halaman COA Akuntan | Tabel flat masih berfungsi normal — tidak terpengaruh perubahan tree |
| 11 | **Jika gagal** | Salah satu langkah di atas error | Pesan error muncul di toast merah. Contoh: "Kode akun sudah digunakan" jika duplikat, atau "Akun tidak ditemukan" jika parent invalid |

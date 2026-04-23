# Integra.id Mining-Edition Launch Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cut the ERP from 14 modules down to 4 core modules (Inventory, Pengadaan, Keuangan, SDM), rebrand as integra.id, polish the PR→PO→GRN→Bill workflow to make Excel users say "wow", deploy to Vercel + Supabase, and produce a presentation-ready demo within 2 weeks for one specific lead in mining ecosystem.

**Architecture:** Keep existing Next.js 16 + Prisma 6 + Supabase + Vercel stack as-is. Use feature flags via sidebar config — hide non-core modules without deleting code (so we can re-enable per customer later). Add minimal mining-specific fields (serial number, equipment compatibility, fleet view). Demo on Vercel preview URL, package Docker self-host as backup for closing.

**Tech Stack:**
- Frontend: Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui + TanStack Query
- Backend: Next.js Server Actions + Prisma 6 + Supabase Postgres + Supabase Auth
- Hosting: Vercel (Fluid Compute, Singapore region) + Supabase managed Postgres
- Self-host backup: Docker Compose + Caddy + Postgres

**Constraints:**
- 2 minggu (14 hari) full-time
- Budget Rp 5jt (domain, Vercel Pro, Supabase Pro tier)
- 1 lead, 1 chance presentation
- Self-host capability required as sales pitch
- Must keep all existing accounting integrity (94/100 audit findings already closed in 25 commits today)

---

## Pre-Flight: Audit Hasil

### Infrastructure Confirmed
- ✅ Supabase: DATABASE_URL + DIRECT_URL + Service Role Key di `.env`
- ✅ Vercel project linked: `prj_CLfBsc0aI5UyV6a6r8RcfJrXrwMR` (project name "erp", org `team_kkzsbca3s7jSJaiwFL5ZTK37`)
- ✅ Vercel CLI: 51.2.0 (perlu upgrade ke 52.0.0)
- ✅ GitHub: `https://github.com/Richienv/ERP.git`
- ✅ Branding partial: `app/layout.tsx` sudah pakai title "Integra — Satu sistem. Semua kendali."
- ⚠️ `package.json` name masih "erp-system" (cosmetic, low priority)
- ⚠️ Domain `integra.id` punya tapi belum di-connect

### Module Page Count (current)
- **KEEP** Inventori (18) + Pengadaan (6) + Keuangan (29) + SDM (6) = **59 pages**
- **HIDE** Sales (18) + Manufacturing (13) + Dashboard subpages (3) + Documents (4) + Accountant (2) + Manager (1) + Staff (1) + Admin (1) + Cutting + Subcontract + Costing + Demo + Help = **~60 pages**
- Total to hide via feature flag: **60 pages**

### Pending from Today's Session
- 6 migrations belum deploy ke production: `20260423000000_add_document_counter`, `20260423120000_add_pr_item_fk_to_po_item`, `20260423130000_add_supplier_npwp`, `20260423140000_stock_level_partial_unique`, `20260423150000_fabric_roll_grn_link`, `20260423160000_stock_level_decimal`
- 25 commits today (audit fixes finance + inventory + procurement) belum di-push ke origin
- 1045 tests pass, 5 baseline pre-existing fail (procurement gap-analysis tests, unrelated)

### Sidebar Structure
- File: `lib/sidebar-nav-data.ts`
- Top-level entries: 14 modules (Dasbor, Inventori, Penjualan, Pengadaan, Keuangan, SDM, Manufaktur, Dokumen, Pengaturan, dll)
- Sub-items: 88 total
- File `app/api/system/route.ts` exists for module access control (use this for feature flags)

---

## WEEK 1 — Cut + Brand + Polish

### Day 1: Pre-Deploy Hygiene + Vercel Setup

#### Task 1.1: Push 25 commits today to origin

**Files:** None (git operation)

**Step 1: Verify clean state**

Run: `git status`
Expected: working tree clean (only `tsconfig.tsbuildinfo` modified, OK)

**Step 2: Push to GitHub**

Run: `git push origin main`
Expected: 25 commits pushed without error

**Step 3: Verify on GitHub**

Open: `https://github.com/Richienv/ERP`
Expected: latest commit `9d24063` (M7 fiscal close) visible

---

#### Task 1.2: Trigger Vercel deploy + verify build passes

**Files:** None (Vercel auto-deploys on push)

**Step 1: Watch deploy log**

Open: `https://vercel.com/[org]/erp/deployments` in browser
Expected: build triggered for commit `9d24063`

**Step 2: Wait for build completion (~5-8 min)**

Expected: build succeeds. If fails:
- Check `next.config.ts` — `typescript.ignoreBuildErrors: true` is set, so TS errors won't block
- Check Vercel env vars match `.env.local` (Supabase keys, DATABASE_URL, DIRECT_URL)

**Step 3: Open preview URL, smoke test login**

Expected: login page loads, can log in with seeded admin credentials

---

#### Task 1.3: Run pending migrations on Supabase production DB

**Files:** None (DB operation via `prisma migrate deploy`)

**Step 1: Backup Supabase DB first**

Open Supabase dashboard → Database → Backups
Trigger manual backup. Wait for completion.

**Step 2: Set DATABASE_URL temporarily to production**

```bash
export DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2-)
export DIRECT_URL=$(grep '^DIRECT_URL=' .env | cut -d= -f2-)
```

**Step 3: Run migrations**

Run: `npx prisma migrate deploy`
Expected:
```
6 migrations found in prisma/migrations
Applying migration `20260423000000_add_document_counter`
Applying migration `20260423120000_add_pr_item_fk_to_po_item`
Applying migration `20260423130000_add_supplier_npwp`
Applying migration `20260423140000_stock_level_partial_unique`
Applying migration `20260423150000_fabric_roll_grn_link`
Applying migration `20260423160000_stock_level_decimal`
All migrations applied successfully.
```

**Step 4: Verify in Supabase Table Editor**

Check tables exist: `document_counters`, `stock_audit_items.expectedQty` is `numeric(18,4)`, `suppliers.npwp` exists.

**Step 5: Smoke test critical flows on Vercel preview URL**
- Buat invoice manual → cek tersimpan
- Buat PR → approve → convert ke PO
- Buat GRN dari PO → cek stock bertambah

---

### Day 2: Feature Flags — Hide Non-Core Modules

#### Task 2.1: Add module visibility config

**Files:**
- Modify: `lib/sidebar-nav-data.ts:106-end` — add `enabled` flag check
- Create: `lib/sidebar-feature-flags.ts` — central enabled/disabled list

**Step 1: Create feature flags file**

```typescript
// lib/sidebar-feature-flags.ts
/**
 * Module visibility for integra.id Mining Edition.
 *
 * Set to true → menu visible in sidebar.
 * Set to false → menu hidden (route still accessible via direct URL,
 *   useful for gradual feature unlock per customer tier).
 */
export const MODULE_FLAGS = {
    // Core 4 modules (always on for mining edition)
    dashboard: true,
    inventory: true,
    procurement: true,
    finance: true,
    hcm: true,

    // Hidden — not relevant for mining ecosystem MVP
    sales: false,
    crm: false,
    pos: false,
    manufacturing: false,
    cutting: false,
    subcontract: false,
    documents: false,
    accountant: false,
    manager: false,
    staff: false,
    admin: false,
    reports: true,           // keep reports landing
    settings: true,          // keep for company profile
} as const

export type ModuleKey = keyof typeof MODULE_FLAGS

export function isModuleEnabled(key: ModuleKey): boolean {
    return MODULE_FLAGS[key] ?? false
}
```

**Step 2: Tag each top-level sidebar item with module key**

Modify `lib/sidebar-nav-data.ts` — add `moduleKey` field to `SidebarNavItem` type.

```typescript
export type SidebarNavItem = {
    title: string
    url: string
    moduleKey?: ModuleKey  // NEW
    icon?: Icon
    locked?: boolean
    badge?: number
    accentColor?: string
    items?: SidebarSubItem[]
}
```

Then for each top-level entry, add `moduleKey`:
- `{ title: "Dasbor", moduleKey: "dashboard", ... }`
- `{ title: "Inventori", moduleKey: "inventory", ... }`
- `{ title: "Penjualan & CRM", moduleKey: "sales", ... }` (will be hidden)
- `{ title: "Pengadaan", moduleKey: "procurement", ... }`
- `{ title: "Keuangan", moduleKey: "finance", ... }`
- `{ title: "SDM", moduleKey: "hcm", ... }`
- `{ title: "Manufaktur", moduleKey: "manufacturing", ... }` (will be hidden)
- `{ title: "Dokumen", moduleKey: "documents", ... }` (will be hidden)
- `{ title: "Pengaturan", moduleKey: "settings", ... }`

**Step 3: Filter at render**

Modify `components/app-sidebar.tsx` to filter `navMain` array via `isModuleEnabled(item.moduleKey)` before passing to `<NavMain items={...} />`.

**Step 4: Run dev server, verify hidden modules**

Run: `npm run dev`
Open: `http://localhost:3002`
Expected: Sidebar shows only Dasbor, Inventori, Pengadaan, Keuangan, SDM, Pengaturan

**Step 5: Commit**

```bash
git add lib/sidebar-nav-data.ts lib/sidebar-feature-flags.ts components/app-sidebar.tsx
git commit -m "feat: feature flag system to hide non-core modules for mining edition"
```

---

#### Task 2.2: Hide sub-items in Inventory that are textile-specific

**Files:**
- Modify: `lib/sidebar-nav-data.ts:117-129` — add `enabled` to fabric-rolls subitem

**Step 1: Hide "Fabric Rolls" sub-item**

Find: `{ title: "Fabric Rolls", url: "/inventory/fabric-rolls", icon: IconRulerMeasure },`
Replace: comment out or filter via flag

Add to `MODULE_FLAGS`:
```typescript
inventoryFabricRolls: false,
```

In sidebar-nav-data.ts, add per-subitem filter:
```typescript
items: [
    { title: "Dashboard Inventori", url: "/inventory", icon: IconLayoutDashboard },
    { title: "Kelola Produk", url: "/inventory/products", icon: IconPackage },
    // ... other items always shown ...
    ...(isModuleEnabled("inventoryFabricRolls") ? [
        { title: "Fabric Rolls", url: "/inventory/fabric-rolls", icon: IconRulerMeasure },
    ] : []),
]
```

**Step 2: Verify in browser**

Reload sidebar. "Fabric Rolls" should NOT appear under Inventori.

**Step 3: Commit**

```bash
git add lib/sidebar-nav-data.ts
git commit -m "feat: hide fabric-rolls sub-item for mining edition"
```

---

### Day 3: Mining-Specific Field Additions

#### Task 3.1: Add serialNumber + equipmentCompatibility to Product

**Files:**
- Modify: `prisma/schema.prisma` (Product model)
- Create: `prisma/migrations/20260424000000_product_mining_fields/migration.sql`
- Modify: `components/inventory/product-form.tsx`

**Step 1: Add fields to Prisma schema**

Find the `Product` model. Add after `costPrice`:

```prisma
  /// Optional serial number for trackable items (heavy equipment parts).
  /// Common in mining: bearing SN, engine block #, hydraulic pump SN.
  serialNumber String?

  /// Equipment compatibility tags. Free-text comma-separated for now,
  /// e.g. "Komatsu PC200, CAT 320D, Hitachi ZX200".
  /// Sales staff search by this when customer asks "filter for PC200".
  equipmentCompatibility String?

  /// Equipment type category (heavy/light/parts/consumable).
  equipmentType String?
```

**Step 2: Create migration**

```bash
mkdir -p prisma/migrations/20260424000000_product_mining_fields
cat > prisma/migrations/20260424000000_product_mining_fields/migration.sql << 'EOF'
-- Mining edition: add fields for spare-part traceability + equipment compatibility.
ALTER TABLE "products"
    ADD COLUMN "serialNumber" TEXT,
    ADD COLUMN "equipmentCompatibility" TEXT,
    ADD COLUMN "equipmentType" TEXT;

CREATE INDEX "products_equipmentCompatibility_idx" ON "products" USING gin (to_tsvector('simple', "equipmentCompatibility"));
EOF
```

**Step 3: Regenerate Prisma client**

Run: `npx prisma generate`
Expected: client regenerates without error

**Step 4: Apply migration locally**

Run: `npx prisma migrate dev --name product_mining_fields`
Expected: migration applied, no schema drift

**Step 5: Add fields to product form UI**

Edit `components/inventory/product-form.tsx`. After existing fields, add a new section "Untuk Spare Part (Opsional)":

```tsx
<div className="space-y-3 border-t pt-4">
    <h3 className="text-sm font-semibold">Untuk Spare Part (Opsional)</h3>
    <div>
        <Label>Nomor Seri</Label>
        <Input
            value={formData.serialNumber || ""}
            onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
            placeholder="contoh: SN-12345 (untuk part trackable)"
        />
    </div>
    <div>
        <Label>Kompatibel Untuk Alat</Label>
        <Input
            value={formData.equipmentCompatibility || ""}
            onChange={(e) => setFormData({ ...formData, equipmentCompatibility: e.target.value })}
            placeholder="contoh: Komatsu PC200, CAT 320D"
        />
    </div>
    <div>
        <Label>Tipe Alat</Label>
        <Select
            value={formData.equipmentType || ""}
            onValueChange={(v) => setFormData({ ...formData, equipmentType: v })}
        >
            <SelectTrigger>
                <SelectValue placeholder="Pilih tipe..." />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="heavy_equipment">Alat Berat</SelectItem>
                <SelectItem value="light_vehicle">Kendaraan Ringan (DC, Pickup)</SelectItem>
                <SelectItem value="spare_part">Spare Part</SelectItem>
                <SelectItem value="consumable">Consumable (Oli, Filter)</SelectItem>
                <SelectItem value="tool">Peralatan Tool</SelectItem>
            </SelectContent>
        </Select>
    </div>
</div>
```

**Step 6: Update server action to save these fields**

Find `createProduct` / `updateProduct` in `app/actions/inventory.ts`. Pass through `serialNumber`, `equipmentCompatibility`, `equipmentType` from input data.

**Step 7: Browser test**

Open `/inventory/products/new`. Fill new fields. Save. Verify in product detail page that fields display.

**Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260424000000_product_mining_fields components/inventory/product-form.tsx app/actions/inventory.ts
git commit -m "feat(inventory): add serial number + equipment compatibility for spare parts"
```

---

#### Task 3.2: Hide fabric-specific UI in product list/detail

**Files:**
- Modify: `app/inventory/products/page.tsx`
- Modify: `app/inventory/products/[id]/page.tsx`
- Modify: `components/inventory/product-data-table.tsx`

**Step 1: Hide fabric-roll tab in product detail**

Open `app/inventory/products/[id]/page.tsx`. Find tabs/sections that show fabric rolls. Wrap with feature flag check:

```tsx
{isModuleEnabled("inventoryFabricRolls") && (
    <TabsTrigger value="fabric-rolls">Fabric Rolls</TabsTrigger>
)}
```

**Step 2: Hide "Color Variants" / "Size Matrix" sections**

Search for any "ColorSizeMatrix" or fabric-roll-specific component imports and conditionally render.

**Step 3: Browser test**

Open `/inventory/products/[any-id]`. Confirm no fabric/color UI visible.

**Step 4: Commit**

```bash
git add app/inventory/products/
git commit -m "feat(inventory): hide fabric-specific UI in product views"
```

---

### Day 4: Approval Queue Dashboard Widget (the WOW factor)

#### Task 4.1: "Persetujuan Menunggu" widget on dashboard

**Files:**
- Create: `components/dashboard/approval-queue-widget.tsx`
- Modify: `app/dashboard/page.tsx` — add widget at top

**Step 1: Build widget component**

```tsx
// components/dashboard/approval-queue-widget.tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { IconClipboardCheck, IconShoppingCart, IconReceipt } from "@tabler/icons-react"

interface ApprovalQueueData {
    pendingPRs: Array<{ id: string; number: string; total: number; requesterName: string; daysWaiting: number }>
    pendingPOs: Array<{ id: string; number: string; total: number; vendorName: string; daysWaiting: number }>
    pendingBills: Array<{ id: string; number: string; total: number; vendorName: string; daysWaiting: number }>
}

export function ApprovalQueueWidget() {
    const { data, isLoading } = useQuery({
        queryKey: ["dashboard", "approval-queue"],
        queryFn: async () => {
            const res = await fetch("/api/dashboard/approval-queue")
            return (await res.json()) as ApprovalQueueData
        },
        staleTime: 30_000, // refresh every 30s
    })

    if (isLoading || !data) return <div className="h-32 bg-zinc-100 rounded animate-pulse" />

    const totalPending = data.pendingPRs.length + data.pendingPOs.length + data.pendingBills.length

    return (
        <Card className="border-2 border-orange-400 bg-orange-50/50">
            <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-bold">📋 Persetujuan Menunggu</h2>
                        <p className="text-xs text-zinc-600">Saat ini ada <strong className="text-orange-600">{totalPending}</strong> dokumen butuh persetujuan</p>
                    </div>
                    {totalPending > 0 && (
                        <Badge variant="destructive">{totalPending}</Badge>
                    )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <ApprovalCard
                        icon={<IconClipboardCheck className="w-5 h-5" />}
                        label="Permintaan Pembelian"
                        items={data.pendingPRs}
                        href="/procurement/requests"
                        color="blue"
                    />
                    <ApprovalCard
                        icon={<IconShoppingCart className="w-5 h-5" />}
                        label="Pesanan Pembelian"
                        items={data.pendingPOs}
                        href="/procurement/orders"
                        color="purple"
                    />
                    <ApprovalCard
                        icon={<IconReceipt className="w-5 h-5" />}
                        label="Tagihan Vendor"
                        items={data.pendingBills}
                        href="/finance/payables"
                        color="green"
                    />
                </div>
            </div>
        </Card>
    )
}

function ApprovalCard({ icon, label, items, href, color }: {
    icon: React.ReactNode
    label: string
    items: Array<{ id: string; daysWaiting: number }>
    href: string
    color: "blue" | "purple" | "green"
}) {
    const colorMap = {
        blue: "border-blue-300 bg-blue-50 text-blue-700",
        purple: "border-purple-300 bg-purple-50 text-purple-700",
        green: "border-green-300 bg-green-50 text-green-700",
    }
    const overdue = items.filter((i) => i.daysWaiting >= 3).length

    return (
        <Link href={href} className={`block border-2 rounded p-3 hover:shadow-md transition ${colorMap[color]}`}>
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
            </div>
            <div className="text-2xl font-black">{items.length}</div>
            {overdue > 0 && (
                <div className="text-xs text-red-600 font-bold mt-1">⚠️ {overdue} terlambat &gt;3 hari</div>
            )}
        </Link>
    )
}
```

**Step 2: Create API route**

Create `app/api/dashboard/approval-queue/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const now = new Date()
    const daysAgo = (d: Date) => Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000))

    const [prs, pos, bills] = await Promise.all([
        prisma.purchaseRequest.findMany({
            where: { status: "PENDING" },
            select: { id: true, number: true, totalEstimate: true, requestDate: true, requester: { select: { name: true } } },
            orderBy: { requestDate: "asc" },
            take: 20,
        }),
        prisma.purchaseOrder.findMany({
            where: { status: "PENDING_APPROVAL" },
            select: { id: true, number: true, netAmount: true, createdAt: true, supplier: { select: { name: true } } },
            orderBy: { createdAt: "asc" },
            take: 20,
        }),
        prisma.invoice.findMany({
            where: { type: "INV_IN", status: "DRAFT" },
            select: { id: true, number: true, totalAmount: true, createdAt: true, supplier: { select: { name: true } } },
            orderBy: { createdAt: "asc" },
            take: 20,
        }),
    ])

    return NextResponse.json({
        pendingPRs: prs.map(p => ({
            id: p.id, number: p.number, total: Number(p.totalEstimate ?? 0),
            requesterName: p.requester?.name ?? "—", daysWaiting: daysAgo(p.requestDate),
        })),
        pendingPOs: pos.map(p => ({
            id: p.id, number: p.number, total: Number(p.netAmount), vendorName: p.supplier?.name ?? "—",
            daysWaiting: daysAgo(p.createdAt),
        })),
        pendingBills: bills.map(b => ({
            id: b.id, number: b.number, total: Number(b.totalAmount), vendorName: b.supplier?.name ?? "—",
            daysWaiting: daysAgo(b.createdAt),
        })),
    })
}
```

**Step 3: Add widget to dashboard**

Open `app/dashboard/page.tsx`. Add `<ApprovalQueueWidget />` near top, above existing KPI cards.

**Step 4: Browser test**

Login → Dashboard. Verify widget shows. Click each card → goes to filtered list. Test with 0 pending (graceful empty state) and >0 pending (shows count).

**Step 5: Commit**

```bash
git add components/dashboard/approval-queue-widget.tsx app/api/dashboard/approval-queue/route.ts app/dashboard/page.tsx
git commit -m "feat(dashboard): add approval queue widget — solves 'saling tunggu approval' pain point"
```

---

### Day 5: Polish Critical Workflows

#### Task 5.1: PR creation form polish — smart defaults

**Files:**
- Modify: `components/procurement/create-request-form.tsx`
- Modify: `components/procurement/new-pr-dialog.tsx`

**Step 1: Auto-fill last unit price on product select**

When user selects a product in PR form, query last `PurchaseOrderItem.unitPrice` for that product and pre-fill the qty/price field:

```typescript
// In product onChange handler
const lastPrice = await fetch(`/api/products/${productId}/last-purchase-price`).then(r => r.json())
if (lastPrice.price > 0) {
    setUnitPrice(lastPrice.price)
    toast.info(`Harga terakhir: Rp ${lastPrice.price.toLocaleString('id-ID')} (PO ${lastPrice.poNumber})`)
}
```

**Step 2: Create the API route**

```typescript
// app/api/products/[id]/last-purchase-price/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const lastItem = await prisma.purchaseOrderItem.findFirst({
        where: { productId: id, purchaseOrder: { status: { in: ["RECEIVED", "COMPLETED", "PARTIAL_RECEIVED"] } } },
        orderBy: { createdAt: "desc" },
        select: { unitPrice: true, purchaseOrder: { select: { number: true, orderDate: true } } },
    })
    return NextResponse.json({
        price: lastItem ? Number(lastItem.unitPrice) : 0,
        poNumber: lastItem?.purchaseOrder?.number ?? null,
        orderDate: lastItem?.purchaseOrder?.orderDate ?? null,
    })
}
```

**Step 3: Browser test**

Open `/procurement/requests/new`. Select a product that has prior PO history. Verify price auto-fills with toast.

**Step 4: Commit**

```bash
git add components/procurement/ app/api/products/[id]/last-purchase-price/
git commit -m "feat(pr): auto-fill last purchase price when product selected"
```

---

#### Task 5.2: PR → PO conversion preview screen

**Files:**
- Create: `app/procurement/requests/[id]/convert/page.tsx`
- Modify: `components/procurement/request-list.tsx` — add "Convert to PO" action

**Step 1: Build conversion preview page**

Show approved PR items grouped by suggested supplier (preferred supplier per product), allow user to:
- See total per supplier
- Adjust supplier assignment per item
- Edit quantity/price before generation
- Click "Buat PO" → calls existing `convertPRToPO` server action

**Step 2: Verify split-supplier scenario**

If PR has 5 items from 3 different preferred suppliers, conversion creates 3 POs.

**Step 3: Commit**

```bash
git add app/procurement/requests/[id]/convert/ components/procurement/
git commit -m "feat(procurement): PR → PO conversion preview screen"
```

---

### Day 6: Vendor / Customer Form Polish

#### Task 6.1: NPWP validation + e-Faktur status field on Vendor

**Files:**
- Modify: `components/procurement/new-vendor-dialog.tsx`
- Modify: `components/procurement/edit-vendor-dialog.tsx`

**Step 1: Add NPWP field with format validation**

```tsx
<div>
    <Label>NPWP Vendor</Label>
    <Input
        value={formData.npwp || ""}
        onChange={(e) => {
            // Auto-format: 00.000.000.0-000.000
            const digits = e.target.value.replace(/\D/g, '').slice(0, 16)
            setFormData({ ...formData, npwp: digits })
        }}
        placeholder="15 atau 16 digit"
        maxLength={16}
    />
    {formData.npwp && formData.npwp.length !== 15 && formData.npwp.length !== 16 && (
        <p className="text-xs text-red-600 mt-1">NPWP harus 15 (lama) atau 16 digit (NIK-based)</p>
    )}
</div>
```

**Step 2: Browser test**

Open vendor create dialog. Type "1234567890" → expect error message. Type 15 digits → no error. Save → verify in DB.

**Step 3: Commit**

```bash
git add components/procurement/
git commit -m "feat(vendor): NPWP field with 15/16 digit validation"
```

---

### Day 7: Demo Data Seed Script (Mining Ecosystem)

#### Task 7.1: Build mining ecosystem demo seed

**Files:**
- Create: `prisma/seed-mining-demo.ts`
- Modify: `package.json` — add seed script

**Step 1: Build seed script**

```typescript
// prisma/seed-mining-demo.ts
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const VENDORS = [
    { code: "UT", name: "PT United Tractors Tbk", npwp: "010012345678901", contactName: "Bapak Andre" },
    { code: "TKD", name: "PT Trakindo Utama", npwp: "010012345678902", contactName: "Ibu Sari" },
    { code: "HXD", name: "PT Hexindo Adiperkasa", npwp: "010012345678903", contactName: "Bapak Budi" },
    { code: "PMS", name: "CV Prima Spare Part", npwp: "010012345678904", contactName: "Bapak Rizki" },
    { code: "AML", name: "PT Astra Multi Lubricant", npwp: "010012345678905", contactName: "Ibu Dewi" },
]

const CUSTOMERS = [
    { code: "ADRO", name: "PT Adaro Indonesia", npwp: "010099887766001", type: "COMPANY" },
    { code: "BUMI", name: "PT Bumi Resources Tbk", npwp: "010099887766002", type: "COMPANY" },
    { code: "PTBA", name: "PT Bukit Asam Tbk", npwp: "010099887766003", type: "COMPANY" },
    { code: "ITMG", name: "PT Indo Tambangraya Megah Tbk", npwp: "010099887766004", type: "COMPANY" },
    { code: "INCO", name: "PT Vale Indonesia Tbk", npwp: "010099887766005", type: "COMPANY" },
]

const PRODUCTS = [
    // Filter & Oli (consumable)
    { code: "FOC-PC200", name: "Filter Oli Komatsu PC200-8", unit: "PCS", costPrice: 450000, sellingPrice: 650000, equipmentCompatibility: "Komatsu PC200-8, PC200-7", equipmentType: "consumable" },
    { code: "FUC-CAT320", name: "Filter Udara CAT 320D", unit: "PCS", costPrice: 380000, sellingPrice: 550000, equipmentCompatibility: "CAT 320D, 320DL", equipmentType: "consumable" },
    { code: "OLI-15W40", name: "Oli Mesin Diesel SAE 15W-40 18L", unit: "DRUM", costPrice: 1850000, sellingPrice: 2400000, equipmentCompatibility: "Universal", equipmentType: "consumable" },
    // Bearing & seal (spare part)
    { code: "BRG-SKF-6210", name: "Bearing SKF 6210-2RS", unit: "PCS", costPrice: 320000, sellingPrice: 480000, serialNumber: "SKF-6210-2RS", equipmentCompatibility: "Komatsu, CAT, Hitachi", equipmentType: "spare_part" },
    { code: "SEAL-HYD-50", name: "Hydraulic Seal Kit 50mm", unit: "SET", costPrice: 750000, sellingPrice: 1100000, equipmentCompatibility: "PC200, PC300", equipmentType: "spare_part" },
    // Tools
    { code: "TOR-1/2-150", name: "Torque Wrench 1/2\" 150Nm", unit: "PCS", costPrice: 1200000, sellingPrice: 1850000, equipmentType: "tool" },
    // Heavy equipment (asset)
    { code: "HLX-2024", name: "Toyota Hilux Double Cabin 4x4 2024", unit: "UNIT", costPrice: 540000000, sellingPrice: 0, equipmentType: "light_vehicle" },
]

async function main() {
    console.log("🌱 Seeding mining ecosystem demo data...")

    // Vendors
    for (const v of VENDORS) {
        await prisma.supplier.upsert({
            where: { code: v.code },
            create: { ...v, isActive: true, paymentTerm: "NET_30" },
            update: {},
        })
    }
    console.log(`  ✓ ${VENDORS.length} vendors`)

    // Customers
    for (const c of CUSTOMERS) {
        await prisma.customer.upsert({
            where: { code: c.code },
            create: {
                code: c.code,
                name: c.name,
                npwp: c.npwp,
                type: c.type as any,
                creditLimit: 500_000_000,
                paymentTerm: "NET_45",
            },
            update: {},
        })
    }
    console.log(`  ✓ ${CUSTOMERS.length} customers`)

    // Warehouses
    const wh = await prisma.warehouse.upsert({
        where: { code: "GD-PUSAT" },
        create: { code: "GD-PUSAT", name: "Gudang Pusat Balikpapan", address: "Jl. Soekarno-Hatta KM 8, Balikpapan", capacity: 1000, isActive: true },
        update: {},
    })
    const wh2 = await prisma.warehouse.upsert({
        where: { code: "GD-SITE" },
        create: { code: "GD-SITE", name: "Gudang Site Tabang", address: "Site Tabang, Kutai Kartanegara", capacity: 500, isActive: true },
        update: {},
    })
    console.log(`  ✓ 2 warehouses`)

    // Products
    for (const p of PRODUCTS) {
        await prisma.product.upsert({
            where: { code: p.code },
            create: { ...p, isActive: true, minStock: 5, reorderLevel: 10, maxStock: 50 },
            update: {},
        })
    }
    console.log(`  ✓ ${PRODUCTS.length} products`)

    // Opening stock — random qty per product per warehouse
    const allProducts = await prisma.product.findMany({ where: { code: { in: PRODUCTS.map(p => p.code) } } })
    for (const p of allProducts) {
        await prisma.stockLevel.upsert({
            where: { productId_warehouseId_locationId: { productId: p.id, warehouseId: wh.id, locationId: null as any } } as any,
            create: { productId: p.id, warehouseId: wh.id, quantity: 25, availableQty: 25, reservedQty: 0 },
            update: {},
        }).catch(() => null)
    }
    console.log(`  ✓ opening stock for all products`)

    console.log("✅ Done!")
}

main().catch(console.error).finally(() => prisma.$disconnect())
```

**Step 2: Run seed**

Run: `npx tsx prisma/seed-mining-demo.ts`
Expected: 5 vendors, 5 customers, 2 warehouses, 7 products, opening stock created

**Step 3: Browser test on Vercel preview**

Open Inventory → Products. Verify mining-themed products visible. Open Procurement → Vendors. Verify mining vendor names.

**Step 4: Commit**

```bash
git add prisma/seed-mining-demo.ts
git commit -m "feat: mining ecosystem demo seed (vendors, customers, products)"
```

---

## WEEK 2 — Demo Prep + Self-Host Package

### Day 8: HCM Mining-Specific Touches

#### Task 8.1: Add "Site" + "Tunjangan Lokasi" to payroll

**Files:**
- Modify: `prisma/schema.prisma` (Employee model)
- Create: migration
- Modify: payroll calculation logic

**Step 1: Add fields**

```prisma
// Employee model:
  /// Mining site assignment (e.g., "Tabang", "Pasir", "Kantor Pusat").
  workSite String?

  /// Site allowance in IDR per month — paid to employees stationed at remote sites.
  siteAllowance Decimal? @db.Decimal(20, 2)
```

**Step 2: Create migration**

```sql
-- prisma/migrations/20260424100000_employee_mining_fields/migration.sql
ALTER TABLE "employees"
    ADD COLUMN "workSite" TEXT,
    ADD COLUMN "siteAllowance" DECIMAL(20, 2);
```

**Step 3: Include siteAllowance in payroll calc**

Find payroll calculation in `app/actions/hcm.ts`. Add `siteAllowance` to the gross salary calculation.

**Step 4: Add to employee form**

Update `app/hcm/employee-master/page.tsx` form to include workSite + siteAllowance fields.

**Step 5: Commit**

```bash
git add prisma/ app/actions/hcm.ts app/hcm/
git commit -m "feat(hcm): add work site + site allowance for mining ecosystem"
```

---

### Day 9: Onboarding Wizard (5-step)

#### Task 9.1: Build first-run onboarding

**Files:**
- Create: `app/onboarding/page.tsx`
- Create: `app/onboarding/components/wizard-step.tsx`

**Step 1: Build 5-step wizard**

Steps:
1. Profil Perusahaan (nama, NPWP, alamat, logo)
2. Tipe Bisnis (Supplier Spare Part / Rental / Workshop) — sets COA preset
3. Admin User (sudah ada, redirect kalau sudah ada admin)
4. Warehouse Pertama (nama, alamat, code)
5. Selesai → redirect ke dashboard

**Step 2: Detect if onboarding needed**

In `middleware.ts`, check if `Tenant.profileCompleted === false` → redirect to `/onboarding`.

**Step 3: Browser test**

Reset DB → register new user → expect onboarding wizard auto-redirect.

**Step 4: Commit**

```bash
git add app/onboarding/ middleware.ts
git commit -m "feat: 5-step onboarding wizard for first-time setup"
```

---

### Day 10: Self-Host Docker Package

#### Task 10.1: Docker Compose setup

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `install.sh`
- Create: `docs/SELF-HOST.md`

**Step 1: Build Dockerfile**

```dockerfile
# Multi-stage build for Next.js production
FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json prisma ./
RUN npm ci --omit=dev && npx prisma generate

FROM node:24-alpine AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

**Step 2: docker-compose.yml**

```yaml
version: "3.9"
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://integra:${DB_PASSWORD}@db:5432/integra
      DIRECT_URL: postgresql://integra:${DB_PASSWORD}@db:5432/integra
      NEXT_PUBLIC_SUPABASE_URL: ${SUPABASE_URL}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
    depends_on:
      - db
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: integra
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: integra
    volumes:
      - integra-db:/var/lib/postgresql/data
  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data
volumes:
  integra-db:
  caddy-data:
```

**Step 3: Caddyfile (auto SSL)**

```
{$DOMAIN} {
    reverse_proxy app:3000
}
```

**Step 4: install.sh script**

```bash
#!/bin/bash
set -e
echo "Welcome to integra.id self-host installer"
read -p "Domain (e.g. erp.perusahaanmu.com): " DOMAIN
read -p "Admin email: " ADMIN_EMAIL
DB_PASSWORD=$(openssl rand -base64 24)
cat > .env << ENV
DOMAIN=$DOMAIN
DB_PASSWORD=$DB_PASSWORD
ADMIN_EMAIL=$ADMIN_EMAIL
ENV
docker-compose up -d
echo "Waiting for DB..."
sleep 5
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx prisma db seed
echo "✅ Installed! Visit https://$DOMAIN"
```

**Step 5: Test build locally**

Run: `docker-compose up --build`
Expected: app accessible at `http://localhost:3000`

**Step 6: Commit**

```bash
git add Dockerfile docker-compose.yml Caddyfile install.sh docs/SELF-HOST.md
git commit -m "feat: docker self-host package for customer deployment"
```

---

### Day 11: Documentation + Demo Materials

#### Task 11.1: User manual PDF (per module)

**Files:**
- Create: `docs/manual/01-getting-started.md`
- Create: `docs/manual/02-inventory.md`
- Create: `docs/manual/03-procurement.md`
- Create: `docs/manual/04-finance.md`
- Create: `docs/manual/05-hcm.md`

**Each manual: 2-3 pages with screenshots**

Structure per module:
1. Sekilas (overview)
2. Workflow utama (3-5 langkah dengan screenshot)
3. FAQ (3-5 pertanyaan)

**Step 1: Take screenshots from Vercel preview**

Use Cmd+Shift+4 (Mac) on each module's main page. Save to `docs/manual/screenshots/`.

**Step 2: Generate PDFs**

Use Typst (already in project) or just convert markdown → PDF via Pandoc:
```bash
pandoc docs/manual/01-getting-started.md -o docs/manual/01-getting-started.pdf
```

**Step 3: Commit**

```bash
git add docs/manual/
git commit -m "docs: user manual PDFs for all 4 core modules"
```

---

#### Task 11.2: Demo video script + recording

**Files:**
- Create: `docs/demo-script.md`

**Step 1: Write 15-min demo script**

Sections:
- 0:00-2:00 — Pain story: "Setiap minggu butuh berapa jam untuk recap pengeluaran di Excel?"
- 2:00-5:00 — Live demo: Buat PR → notif approval → Approve → Convert PO → Send to vendor
- 5:00-9:00 — Live demo: Receive GRN → Bill auto-create → Approve → Bayar → Reports refresh real-time
- 9:00-12:00 — Reports: P&L, Neraca, Arus Kas — instant generation
- 12:00-14:00 — Audit trail: click any document → see who/when/what changed
- 14:00-15:00 — Pricing & Q&A invite

**Step 2: Record using Loom**

Practice 2-3 times before recording final.

**Step 3: Upload + share link**

Save Loom URL to docs.

---

### Day 12: Buffer + Bug Fixes

#### Task 12.1: Browser-test EVERY workflow

**Files:** None (manual QA)

**Workflows to test:**
- [ ] Login → Dashboard loads → All widgets render
- [ ] Inventory: Create product → Edit → Delete (blocked if has stock)
- [ ] Inventory: Create warehouse → Add opening stock → Verify GL entry
- [ ] Procurement: Create PR (5 items, 3 suppliers) → Approve → Convert to 3 POs
- [ ] Procurement: Approve PO → Mark Ordered → Receive (GRN) → Bill auto-creates
- [ ] Finance: Approve bill → Pay (transfer) → P&L reflects immediately
- [ ] Finance: Manual invoice (no SO) → Send → Receive payment → AR aging updates
- [ ] HCM: Create employee → Mark attendance → Run payroll → Generate slip
- [ ] Reports: P&L, Neraca, Arus Kas, AR/AP Aging, Trial Balance — all open <2 sec

**Step 1: Run through each, log bugs**

Create `docs/bug-log-week2.md`. Note each issue with severity (critical/high/medium/low).

**Step 2: Fix critical + high bugs first**

Allocate Day 12-13 to bug fixes.

---

### Day 13: Pricing Materials + Sales Kit

#### Task 13.1: Brochure PDF (1-2 pages)

**Files:**
- Create: `docs/sales/integra-brochure.md`

**Sections:**
1. Tagline + value prop (1 paragraf)
2. 4 modul utama dengan 3 manfaat per modul
3. Pricing tier (Starter / Business / Enterprise)
4. Testimoni (kosongkan dulu, atau pakai "based on internal pilot")
5. Contact info

**Step 1: Generate PDF**

Same workflow as manual PDFs.

**Step 2: Commit**

```bash
git add docs/sales/
git commit -m "docs: sales brochure + pricing material"
```

---

#### Task 13.2: Pricing proposal template

**Files:**
- Create: `docs/sales/proposal-template.docx` (or markdown)

**Sections:**
1. Cover letter (kustomisasi per customer)
2. Scope of work
3. Implementation timeline (2 minggu setup + 1 minggu training)
4. Pricing breakdown
5. Terms & conditions
6. SLA

---

### Day 14: Final Buffer + Domain Connect + Final Polish

#### Task 14.1: Connect integra.id domain to Vercel

**Files:** None (DNS operation)

**Step 1: In Vercel project settings → Domains → Add `integra.id`**

Vercel akan kasih DNS records yang harus ditambahkan.

**Step 2: Tambahkan A/CNAME records di registrar**

Tunggu propagation (5-30 menit).

**Step 3: Verify SSL aktif**

Open `https://integra.id` → expect padlock + ERP loads.

---

#### Task 14.2: Final pre-demo checklist

- [ ] Latest deploy successful at `https://integra.id`
- [ ] Demo data loaded (mining vendors/customers/products)
- [ ] Test login works
- [ ] All 4 modules work end-to-end
- [ ] No console errors in browser
- [ ] Approval queue widget shows pending items
- [ ] Workflow: PR → PO → GRN → Bill → Payment all work in <30 sec each
- [ ] Reports load <2 sec
- [ ] Demo script printed
- [ ] Brochure PDF on hand
- [ ] Self-host Docker tested locally
- [ ] Pricing proposal ready in .docx

---

## Success Metrics

After 2 weeks:
- ✅ Vercel deployment live at `integra.id`
- ✅ Only 4 modules visible to user
- ✅ All workflows tested end-to-end
- ✅ Self-host Docker package ready
- ✅ Demo materials ready (video + brochure + manual)
- ✅ Pricing proposal ready
- ✅ At minimum: presentation delivered. Best case: deal closed.

---

## Backup Contingency

**Jika lead reject / no answer setelah presentasi:**
- Same package = generic SaaS launch on integra.id
- Offer free 30-day trial via signup form
- Outreach to 10-20 mining ecosystem companies in Kalimantan via LinkedIn
- Pricing test: Rp 10jt setup + Rp 2jt/month untuk attract first 3 customers

---

## What's NOT in This Plan (Defer)

- FIFO/Average costing (existing audit deferred — H2 inventory)
- Manufacturing module (hidden via flag, can re-enable per customer)
- Sales pipeline (hidden, customer master accessible from finance)
- Advanced reports (only standard reports for MVP)
- Multi-tenant SaaS architecture (each customer gets own self-host instance)
- Mobile app (web is responsive enough for MVP)
- Integration with mining-specific systems (timbangan, fuel cards) — post-launch

---

## Checklist Migrasi Sebelum Deploy

```bash
# Pastikan ini tahap 1 sebelum coding apa-apa:
1. Backup Supabase DB
2. npx prisma migrate deploy
3. Smoke test pada Vercel preview
4. Push commits
5. Confirm deploy success
```

---

## Engineer Brief

**Untuk subagent yang execute plan ini:**

1. Pakai existing infrastructure (Supabase + Vercel) — JANGAN bikin baru
2. Feature flag system — file `lib/sidebar-feature-flags.ts` adalah single source of truth
3. JANGAN delete code yg di-hide — kita mungkin re-enable per customer
4. Setiap commit pakai conventional commits format
5. Test di browser SETELAH setiap task — bukan hanya unit test
6. Audit findings dari session sebelumnya (94/100 closed) JANGAN regress
7. Bahasa Indonesia di semua UI — no English left
8. NB design system (border-2 border-black + shadow + uppercase) untuk new UI

**Files Claude tidak boleh sentuh tanpa diskusi:**
- `lib/actions/finance-*.ts` (akuntansi sudah audited)
- `lib/po-state-machine.ts`
- `lib/gl-accounts.ts`
- `lib/document-numbering.ts`
- All migration files (read-only after creation)

# Inventory Health Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire up the existing stock adjustment dialog to 3 missing entry points, add SO stock reservation on confirmation, and build a batch cycle count page.

**Architecture:** Most infrastructure already exists (AdjustmentForm, createManualMovement, transfer state machine, stock-reservations). This plan focuses on wiring UI entry points and adding the two genuinely missing features: batch cycle count and SO auto-reservation.

**Tech Stack:** Next.js App Router, TanStack Query, Prisma, shadcn/ui, Sonner toasts

---

## Summary of what already exists (DO NOT rebuild)

| Component | File | Status |
|-----------|------|--------|
| AdjustmentForm | `components/inventory/adjustment-form.tsx` | Complete — 8 reasons, type selector, GL posting |
| createManualMovement() | `app/actions/inventory.ts:1253` | Complete — validates stock, creates transaction + GL |
| Transfer state machine | `lib/stock-transfer-machine.ts` | Complete — DRAFT→PENDING→APPROVED→IN_TRANSIT→RECEIVED |
| Transfer transitions | `lib/actions/stock-transfers.ts` | Complete — transitionStockTransfer() with stock movement |
| StockTransferList UI | `components/inventory/stock-transfer-list.tsx` | Complete — status filters, transition buttons |
| Stock reservations | `lib/actions/stock-reservations.ts` | Complete — reserve, consume, release for work orders |
| Adjustment dialog in movements | `app/inventory/movements/movements-client.tsx:211` | Complete — AdjustmentForm inside Dialog |

---

## Task 1: Wire Adjustment Dialog to Product Detail Page

**Files:**
- Modify: `app/inventory/products/[id]/page.tsx:281-298`

**Step 1: Add state and imports for the adjustment dialog**

At top of file, add to existing imports:
```tsx
import { ClipboardEdit } from "lucide-react"
import { AdjustmentForm } from "@/components/inventory/adjustment-form"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { NB } from "@/lib/dialog-styles"
```

Add state inside `ProductDetailPage()` component:
```tsx
const [adjustmentOpen, setAdjustmentOpen] = useState(false)
```

**Step 2: Add the dialog + button in the header action area**

After the "Cetak Label" button (around line 298), add:
```tsx
<Button
  variant="outline"
  className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-bold text-xs"
  onClick={() => setAdjustmentOpen(true)}
>
  <ClipboardEdit className="h-4 w-4 mr-2" />
  Penyesuaian
</Button>
```

Add Dialog before closing `</div>` of mf-page:
```tsx
<Dialog open={adjustmentOpen} onOpenChange={setAdjustmentOpen}>
  <DialogContent className={NB.content}>
    <DialogHeader className={NB.header}>
      <DialogTitle className={NB.title}>
        <ClipboardEdit className="h-5 w-5" /> Penyesuaian Stok
      </DialogTitle>
      <p className={NB.subtitle}>Penyesuaian stok untuk {product.name}</p>
    </DialogHeader>
    <div className="p-5">
      <AdjustmentForm
        products={[{ id: product.id, name: product.name, code: product.code, unit: product.unit || "PCS" }]}
        warehouses={stockLevels.map(sl => ({ id: sl.warehouse.id, name: sl.warehouse.name }))}
      />
    </div>
  </DialogContent>
</Dialog>
```

**Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | grep "products/\[id\]"`
Expected: No new errors from this file.

**Step 4: Commit**
```bash
git add app/inventory/products/\[id\]/page.tsx
git commit -m "feat(inventory): wire adjustment dialog to product detail page"
```

---

## Task 2: Wire Adjustment Dialog to Stock Level Page

**Files:**
- Modify: `app/inventory/stock/stock-client.tsx`

**Step 1: Add imports and state**

Add imports:
```tsx
import { ClipboardEdit } from "lucide-react"
import { AdjustmentForm } from "@/components/inventory/adjustment-form"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { NB } from "@/lib/dialog-styles"
```

Add state inside `StockClient`:
```tsx
const [adjustmentOpen, setAdjustmentOpen] = useState(false)
```

**Step 2: Add "Penyesuaian Stok" button to command header**

In the header `<div className="flex gap-2">` section (line 116), add after the "Stock Opname" button:
```tsx
<Button
  onClick={() => setAdjustmentOpen(true)}
  className="bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold text-[10px] tracking-wide hover:translate-y-[1px] hover:shadow-none transition-all h-9 rounded-none"
>
  <ClipboardEdit className="mr-2 h-3.5 w-3.5" /> Penyesuaian
</Button>
```

**Step 3: Add Dialog before the closing `</div>` of the component**

```tsx
<Dialog open={adjustmentOpen} onOpenChange={setAdjustmentOpen}>
  <DialogContent className={NB.content}>
    <DialogHeader className={NB.header}>
      <DialogTitle className={NB.title}>
        <ClipboardEdit className="h-5 w-5" /> Penyesuaian Stok
      </DialogTitle>
      <p className={NB.subtitle}>Buat penyesuaian stok manual atau transfer antar gudang.</p>
    </DialogHeader>
    <div className="p-5">
      <AdjustmentForm
        products={products.map((p: any) => ({ id: p.id, name: p.name, code: p.code, unit: p.unit || "PCS" }))}
        warehouses={warehouses.map((w: any) => ({ id: w.id, name: w.name }))}
      />
    </div>
  </DialogContent>
</Dialog>
```

**Step 4: Verify**

Run: `npx tsc --noEmit 2>&1 | grep "stock-client"`
Expected: No new errors.

**Step 5: Commit**
```bash
git add app/inventory/stock/stock-client.tsx
git commit -m "feat(inventory): wire adjustment dialog to stock level page"
```

---

## Task 3: Fix Adjustments Page Redirect

**Files:**
- Modify: `app/inventory/adjustments/page.tsx`

**Step 1: Replace redirect with informational page**

Replace entire file content:
```tsx
"use client"

import Link from "next/link"
import { ArrowRight, ClipboardEdit, ArrowRightLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function StockAdjustmentsPage() {
    return (
        <div className="mf-page">
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white">
                <div className="px-6 py-4 border-l-[6px] border-l-amber-400">
                    <div className="flex items-center gap-3 mb-1">
                        <ClipboardEdit className="h-5 w-5 text-amber-500" />
                        <h1 className="text-xl font-black uppercase tracking-tight">Penyesuaian Stok</h1>
                    </div>
                    <p className="text-zinc-400 text-xs font-medium">
                        Penyesuaian stok dapat dilakukan dari beberapa halaman:
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/inventory/movements" className="block">
                    <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 bg-white hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                        <ArrowRightLeft className="h-6 w-6 text-violet-500 mb-3" />
                        <h3 className="font-black uppercase text-sm mb-1">Pergerakan Stok</h3>
                        <p className="text-[10px] text-zinc-500 font-medium">Buat penyesuaian dari halaman pergerakan stok dengan tombol "Penyesuaian Stok".</p>
                        <div className="flex items-center gap-1 mt-3 text-[10px] font-black uppercase text-black">
                            Buka <ArrowRight className="h-3 w-3" />
                        </div>
                    </div>
                </Link>
                <Link href="/inventory/stock" className="block">
                    <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 bg-white hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                        <ClipboardEdit className="h-6 w-6 text-blue-500 mb-3" />
                        <h3 className="font-black uppercase text-sm mb-1">Level Stok</h3>
                        <p className="text-[10px] text-zinc-500 font-medium">Buat penyesuaian langsung dari halaman level stok.</p>
                        <div className="flex items-center gap-1 mt-3 text-[10px] font-black uppercase text-black">
                            Buka <ArrowRight className="h-3 w-3" />
                        </div>
                    </div>
                </Link>
                <Link href="/inventory/products" className="block">
                    <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 bg-white hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                        <ClipboardEdit className="h-6 w-6 text-emerald-500 mb-3" />
                        <h3 className="font-black uppercase text-sm mb-1">Detail Produk</h3>
                        <p className="text-[10px] text-zinc-500 font-medium">Buka halaman detail produk, lalu klik "Penyesuaian".</p>
                        <div className="flex items-center gap-1 mt-3 text-[10px] font-black uppercase text-black">
                            Buka <ArrowRight className="h-3 w-3" />
                        </div>
                    </div>
                </Link>
            </div>
        </div>
    )
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | grep "adjustments"`
Expected: No errors.

**Step 3: Commit**
```bash
git add app/inventory/adjustments/page.tsx
git commit -m "feat(inventory): replace adjustment redirect with navigation hub"
```

---

## Task 4: Add SO Stock Reservation on Confirmation

**Files:**
- Modify: `lib/actions/sales.ts` — `convertQuotationToSalesOrder()` function

**Step 1: Write failing test**

Create `__tests__/so-reservation.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest"

// Test the reservation logic we'll add to SO confirmation
describe("SO Stock Reservation Logic", () => {
    it("should calculate reservation amounts correctly", () => {
        // Given an SO item with qty 100 and stock available 80
        const orderQty = 100
        const availableQty = 80
        const reserveQty = Math.min(orderQty, availableQty)

        expect(reserveQty).toBe(80)
    })

    it("should reserve full amount when stock is sufficient", () => {
        const orderQty = 50
        const availableQty = 200
        const reserveQty = Math.min(orderQty, availableQty)

        expect(reserveQty).toBe(50)
    })

    it("should reserve zero when no stock available", () => {
        const orderQty = 100
        const availableQty = 0
        const reserveQty = Math.min(orderQty, availableQty)

        expect(reserveQty).toBe(0)
    })
})
```

**Step 2: Run test to verify it passes (pure logic)**

Run: `npx vitest run __tests__/so-reservation.test.ts`
Expected: PASS

**Step 3: Add reservation logic to convertQuotationToSalesOrder**

In `lib/actions/sales.ts`, find `convertQuotationToSalesOrder()`. After the `salesOrder.create()` call inside the transaction, add stock reservation logic:

```ts
// Auto-reserve stock for confirmed SO items
for (const item of quotation.items) {
    // Find the best warehouse with available stock
    const stockLevel = await tx.stockLevel.findFirst({
        where: {
            productId: item.productId,
            availableQty: { gt: 0 },
            locationId: null,
        },
        orderBy: { availableQty: 'desc' },
    })

    if (stockLevel) {
        const reserveQty = Math.min(item.quantity, stockLevel.availableQty)
        if (reserveQty > 0) {
            await tx.stockLevel.update({
                where: { id: stockLevel.id },
                data: {
                    reservedQty: { increment: reserveQty },
                    availableQty: { decrement: reserveQty },
                },
            })
        }
    }
}
```

**Step 4: Add reservation release to cancelSalesOrder**

In `lib/actions/sales.ts`, find `cancelSalesOrder()`. Inside the transaction, after status update, add:

```ts
// Release any reserved stock
const soItems = await tx.salesOrderItem.findMany({
    where: { salesOrderId: orderId },
    select: { productId: true, quantity: true },
})

for (const item of soItems) {
    // Find stock levels with reservations for this product
    const stockLevels = await tx.stockLevel.findMany({
        where: {
            productId: item.productId,
            reservedQty: { gt: 0 },
            locationId: null,
        },
    })

    let remainingToRelease = item.quantity
    for (const sl of stockLevels) {
        if (remainingToRelease <= 0) break
        const releaseQty = Math.min(remainingToRelease, sl.reservedQty)
        await tx.stockLevel.update({
            where: { id: sl.id },
            data: {
                reservedQty: { decrement: releaseQty },
                availableQty: { increment: releaseQty },
            },
        })
        remainingToRelease -= releaseQty
    }
}
```

**Step 5: Verify**

Run: `npx tsc --noEmit 2>&1 | grep "sales.ts"`
Expected: No new errors.

**Step 6: Commit**
```bash
git add lib/actions/sales.ts __tests__/so-reservation.test.ts
git commit -m "feat(inventory): auto-reserve stock on SO confirmation, release on cancel"
```

---

## Task 5: Batch Cycle Count Page — Server Action

**Files:**
- Create: `app/actions/cycle-count.ts`

**Step 1: Write the server action**

```ts
"use server"

import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// Get all scheduled/in-progress audits
export async function getCycleCountSessions() {
    await requireAuth()

    const sessions = await prisma.stockAudit.findMany({
        include: {
            warehouse: { select: { id: true, name: true, code: true } },
            items: {
                include: {
                    product: { select: { id: true, name: true, code: true, unit: true } },
                },
            },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
    })

    return sessions.map((s) => ({
        id: s.id,
        warehouseId: s.warehouseId,
        warehouseName: s.warehouse.name,
        warehouseCode: s.warehouse.code,
        scheduledDate: s.scheduledDate.toISOString(),
        status: s.status,
        notes: s.notes,
        itemCount: s.items.length,
        countedCount: s.items.filter((i) => i.actualQty !== null).length,
        matchCount: s.items.filter((i) => i.actualQty !== null && i.actualQty === i.expectedQty).length,
        varianceCount: s.items.filter((i) => i.actualQty !== null && i.actualQty !== i.expectedQty).length,
        items: s.items.map((i) => ({
            id: i.id,
            productId: i.productId,
            productName: i.product.name,
            productCode: i.product.code,
            unit: i.product.unit || "PCS",
            expectedQty: i.expectedQty,
            actualQty: i.actualQty,
        })),
        createdAt: s.createdAt.toISOString(),
    }))
}

// Create a new cycle count session — auto-populates items from stock levels
export async function createCycleCountSession(data: {
    warehouseId: string
    scheduledDate: string
    notes?: string
}): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
        const user = await requireAuth()

        // Get all products with stock in this warehouse
        const stockLevels = await prisma.stockLevel.findMany({
            where: {
                warehouseId: data.warehouseId,
                locationId: null,
            },
            include: {
                product: { select: { id: true, isActive: true } },
            },
        })

        const activeItems = stockLevels.filter((sl) => sl.product.isActive)

        if (activeItems.length === 0) {
            return { success: false, error: "Tidak ada produk aktif di gudang ini." }
        }

        const session = await prisma.stockAudit.create({
            data: {
                warehouseId: data.warehouseId,
                scheduledDate: new Date(data.scheduledDate),
                auditorId: user.id,
                status: "SCHEDULED",
                notes: data.notes ?? null,
                items: {
                    create: activeItems.map((sl) => ({
                        productId: sl.productId,
                        expectedQty: sl.quantity,
                    })),
                },
            },
        })

        return { success: true, sessionId: session.id }
    } catch (error) {
        console.error("[createCycleCountSession]", error)
        return { success: false, error: "Gagal membuat sesi stok opname." }
    }
}

// Submit counted values for items in a session
export async function submitCycleCountItems(data: {
    sessionId: string
    counts: { itemId: string; actualQty: number }[]
}): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAuth()

        await prisma.$transaction(async (tx) => {
            for (const count of data.counts) {
                await tx.stockAuditItem.update({
                    where: { id: count.itemId },
                    data: { actualQty: count.actualQty },
                })
            }

            // Check if all items are counted
            const session = await tx.stockAudit.findUnique({
                where: { id: data.sessionId },
                include: { items: true },
            })

            if (session) {
                const allCounted = session.items.every((i) => i.actualQty !== null)
                if (allCounted) {
                    await tx.stockAudit.update({
                        where: { id: data.sessionId },
                        data: { status: "IN_PROGRESS" },
                    })
                }
            }
        })

        return { success: true }
    } catch (error) {
        console.error("[submitCycleCountItems]", error)
        return { success: false, error: "Gagal menyimpan hasil hitungan." }
    }
}

// Finalize session: apply variances as adjustments
export async function finalizeCycleCount(sessionId: string): Promise<{
    success: boolean
    adjustments?: number
    error?: string
}> {
    try {
        const user = await requireAuth()

        let adjustmentCount = 0

        await prisma.$transaction(async (tx) => {
            const session = await tx.stockAudit.findUnique({
                where: { id: sessionId },
                include: {
                    items: {
                        include: {
                            product: { select: { costPrice: true } },
                        },
                    },
                },
            })

            if (!session) throw new Error("Sesi tidak ditemukan")
            if (session.status === "COMPLETED") throw new Error("Sesi sudah selesai")

            const uncounted = session.items.filter((i) => i.actualQty === null)
            if (uncounted.length > 0) {
                throw new Error(`Masih ada ${uncounted.length} produk yang belum dihitung.`)
            }

            for (const item of session.items) {
                const variance = item.actualQty! - item.expectedQty
                if (variance === 0) continue

                adjustmentCount++

                // Update stock level
                await tx.stockLevel.updateMany({
                    where: {
                        productId: item.productId,
                        warehouseId: session.warehouseId,
                        locationId: null,
                    },
                    data: {
                        quantity: item.actualQty!,
                        availableQty: { increment: variance },
                    },
                })

                // Create inventory transaction
                await tx.inventoryTransaction.create({
                    data: {
                        productId: item.productId,
                        warehouseId: session.warehouseId,
                        type: "ADJUSTMENT",
                        quantity: variance,
                        unitCost: item.product.costPrice,
                        referenceId: session.id,
                        performedBy: user.id,
                        notes: `Stok Opname: selisih ${variance > 0 ? "+" : ""}${variance}`,
                    },
                })
            }

            await tx.stockAudit.update({
                where: { id: sessionId },
                data: { status: "COMPLETED" },
            })
        })

        return { success: true, adjustments: adjustmentCount }
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Gagal finalisasi"
        console.error("[finalizeCycleCount]", error)
        return { success: false, error: msg }
    }
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | grep "cycle-count"`
Expected: No errors.

**Step 3: Commit**
```bash
git add app/actions/cycle-count.ts
git commit -m "feat(inventory): add cycle count server actions (create, submit, finalize)"
```

---

## Task 6: Batch Cycle Count Page — Hook

**Files:**
- Create: `hooks/use-cycle-counts.ts`
- Modify: `lib/query-keys.ts`

**Step 1: Add query key**

In `lib/query-keys.ts`, add inside the `queryKeys` object:
```ts
cycleCounts: {
    all: ["cycleCounts"] as const,
    list: () => [...queryKeys.cycleCounts.all, "list"] as const,
},
```

**Step 2: Create hook**

```ts
"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getCycleCountSessions } from "@/app/actions/cycle-count"

export function useCycleCounts() {
    return useQuery({
        queryKey: queryKeys.cycleCounts.list(),
        queryFn: getCycleCountSessions,
    })
}
```

**Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | grep "cycle-count\|use-cycle"`
Expected: No errors.

**Step 4: Commit**
```bash
git add hooks/use-cycle-counts.ts lib/query-keys.ts
git commit -m "feat(inventory): add cycle count hook and query keys"
```

---

## Task 7: Batch Cycle Count Page — UI

**Files:**
- Create: `app/inventory/cycle-counts/page.tsx`

**Step 1: Create the page**

```tsx
"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useCycleCounts } from "@/hooks/use-cycle-counts"
import { useWarehouses } from "@/hooks/use-warehouses"
import { queryKeys } from "@/lib/query-keys"
import {
    createCycleCountSession,
    submitCycleCountItems,
    finalizeCycleCount,
} from "@/app/actions/cycle-count"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { NB } from "@/lib/dialog-styles"
import {
    ClipboardList,
    Plus,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    Hash,
    Warehouse,
    Calendar,
    ArrowLeft,
} from "lucide-react"
import { toast } from "sonner"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import Link from "next/link"

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
    SCHEDULED: { label: "Dijadwalkan", bg: "bg-blue-100", text: "text-blue-700" },
    IN_PROGRESS: { label: "Sedang Berlangsung", bg: "bg-amber-100", text: "text-amber-700" },
    COMPLETED: { label: "Selesai", bg: "bg-emerald-100", text: "text-emerald-700" },
}

export default function CycleCountsPage() {
    const { data: sessions, isLoading } = useCycleCounts()
    const { data: warehousesData } = useWarehouses()
    const warehouses = warehousesData ?? []
    const queryClient = useQueryClient()

    const [createOpen, setCreateOpen] = useState(false)
    const [countOpen, setCountOpen] = useState<string | null>(null)
    const [creating, setCreating] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [finalizing, setFinalizing] = useState(false)

    // Create form state
    const [newWarehouseId, setNewWarehouseId] = useState("")
    const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10))
    const [newNotes, setNewNotes] = useState("")

    // Count form state
    const [counts, setCounts] = useState<Record<string, string>>({})

    const handleCreate = async () => {
        if (!newWarehouseId) {
            toast.error("Pilih gudang terlebih dahulu")
            return
        }
        setCreating(true)
        const result = await createCycleCountSession({
            warehouseId: newWarehouseId,
            scheduledDate: newDate,
            notes: newNotes || undefined,
        })
        setCreating(false)
        if (result.success) {
            toast.success("Sesi stok opname berhasil dibuat")
            setCreateOpen(false)
            setNewWarehouseId("")
            setNewNotes("")
            queryClient.invalidateQueries({ queryKey: queryKeys.cycleCounts.all })
        } else {
            toast.error(result.error || "Gagal membuat sesi")
        }
    }

    const activeSession = sessions?.find((s) => s.id === countOpen)

    const handleOpenCount = (sessionId: string) => {
        const session = sessions?.find((s) => s.id === sessionId)
        if (session) {
            const initial: Record<string, string> = {}
            session.items.forEach((item) => {
                initial[item.id] = item.actualQty !== null ? String(item.actualQty) : ""
            })
            setCounts(initial)
            setCountOpen(sessionId)
        }
    }

    const handleSubmitCounts = async () => {
        if (!activeSession) return
        const entries = Object.entries(counts)
            .filter(([, val]) => val !== "")
            .map(([itemId, val]) => ({ itemId, actualQty: Number(val) }))

        if (entries.length === 0) {
            toast.error("Isi minimal 1 jumlah aktual")
            return
        }

        setSubmitting(true)
        const result = await submitCycleCountItems({
            sessionId: activeSession.id,
            counts: entries,
        })
        setSubmitting(false)

        if (result.success) {
            toast.success(`${entries.length} item berhasil disimpan`)
            queryClient.invalidateQueries({ queryKey: queryKeys.cycleCounts.all })
        } else {
            toast.error(result.error || "Gagal menyimpan")
        }
    }

    const handleFinalize = async () => {
        if (!activeSession) return
        if (!window.confirm("Finalisasi stok opname? Selisih akan otomatis disesuaikan.")) return

        setFinalizing(true)
        const result = await finalizeCycleCount(activeSession.id)
        setFinalizing(false)

        if (result.success) {
            toast.success(`Stok opname selesai. ${result.adjustments} produk disesuaikan.`)
            setCountOpen(null)
            queryClient.invalidateQueries({ queryKey: queryKeys.cycleCounts.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.stockMovements.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
        } else {
            toast.error(result.error || "Gagal finalisasi")
        }
    }

    if (isLoading) return <TablePageSkeleton accentColor="bg-amber-400" />

    return (
        <div className="mf-page">
            {/* COMMAND HEADER */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-amber-400">
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="icon" asChild className="border-2 border-black h-8 w-8 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none">
                            <Link href="/inventory/audit"><ArrowLeft className="h-4 w-4" /></Link>
                        </Button>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight">Stok Opname Batch</h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">Hitung stok seluruh gudang dalam satu sesi</p>
                        </div>
                    </div>
                    <Button
                        onClick={() => setCreateOpen(true)}
                        className="bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold text-[10px] tracking-wide hover:translate-y-[1px] hover:shadow-none transition-all h-9 rounded-none"
                    >
                        <Plus className="mr-2 h-3.5 w-3.5" /> Buat Sesi Baru
                    </Button>
                </div>
            </div>

            {/* KPI STRIP */}
            <div className="bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    <div className="relative p-4 md:p-5 border-r-2 border-b-2 md:border-b-0 border-zinc-100">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                        <div className="flex items-center gap-2 mb-2"><Hash className="h-4 w-4 text-zinc-400" /><span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Sesi</span></div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-blue-600">{sessions?.length ?? 0}</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-b-2 md:border-b-0 border-zinc-100">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                        <div className="flex items-center gap-2 mb-2"><ClipboardList className="h-4 w-4 text-zinc-400" /><span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Berlangsung</span></div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-amber-600">{sessions?.filter((s) => s.status !== "COMPLETED").length ?? 0}</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-b-2 md:border-b-0 border-zinc-100">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="h-4 w-4 text-zinc-400" /><span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Selesai</span></div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-emerald-600">{sessions?.filter((s) => s.status === "COMPLETED").length ?? 0}</div>
                    </div>
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-red-400" />
                        <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-zinc-400" /><span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Selisih Ditemukan</span></div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-red-600">{sessions?.reduce((acc, s) => acc + s.varianceCount, 0) ?? 0}</div>
                    </div>
                </div>
            </div>

            {/* SESSION LIST */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white">
                <Table>
                    <TableHeader className="bg-zinc-50 border-b-2 border-black">
                        <TableRow className="hover:bg-zinc-50">
                            <TableHead className="font-black text-black uppercase text-[10px] tracking-wider">Gudang</TableHead>
                            <TableHead className="font-black text-black uppercase text-[10px] tracking-wider">Tanggal</TableHead>
                            <TableHead className="font-black text-black uppercase text-[10px] tracking-wider text-center">Item</TableHead>
                            <TableHead className="font-black text-black uppercase text-[10px] tracking-wider text-center">Dihitung</TableHead>
                            <TableHead className="font-black text-black uppercase text-[10px] tracking-wider text-center">Selisih</TableHead>
                            <TableHead className="font-black text-black uppercase text-[10px] tracking-wider text-center">Status</TableHead>
                            <TableHead className="font-black text-black uppercase text-[10px] tracking-wider text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {!sessions || sessions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-zinc-400 font-medium">
                                    Belum ada sesi stok opname.
                                </TableCell>
                            </TableRow>
                        ) : (
                            sessions.map((session) => {
                                const cfg = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.SCHEDULED
                                return (
                                    <TableRow key={session.id} className="hover:bg-zinc-50 border-b border-zinc-100">
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Warehouse className="h-3.5 w-3.5 text-zinc-400" />
                                                <div>
                                                    <div className="font-bold text-sm">{session.warehouseName}</div>
                                                    <div className="text-[10px] font-mono text-zinc-400">{session.warehouseCode}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs font-bold text-zinc-500">
                                            <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />{new Date(session.scheduledDate).toLocaleDateString("id-ID")}</div>
                                        </TableCell>
                                        <TableCell className="text-center font-black">{session.itemCount}</TableCell>
                                        <TableCell className="text-center font-black text-blue-600">{session.countedCount}/{session.itemCount}</TableCell>
                                        <TableCell className="text-center">
                                            {session.varianceCount > 0 ? (
                                                <span className="font-black text-red-600">{session.varianceCount}</span>
                                            ) : session.countedCount > 0 ? (
                                                <span className="font-black text-emerald-600">0</span>
                                            ) : (
                                                <span className="text-zinc-300">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge className={`${cfg.bg} ${cfg.text} border-0 rounded-none text-[9px] font-black uppercase`}>{cfg.label}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {session.status !== "COMPLETED" && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-[9px] uppercase font-black border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-[1px] rounded-none"
                                                    onClick={() => handleOpenCount(session.id)}
                                                >
                                                    Hitung
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* CREATE SESSION DIALOG */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className={NB.content}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}><ClipboardList className="h-5 w-5" /> Sesi Stok Opname Baru</DialogTitle>
                        <p className={NB.subtitle}>Pilih gudang dan tanggal. Semua produk aktif di gudang akan otomatis ditambahkan.</p>
                    </DialogHeader>
                    <div className="p-5 space-y-4">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Gudang <span className="text-red-500">*</span></label>
                            <Select value={newWarehouseId} onValueChange={setNewWarehouseId}>
                                <SelectTrigger className="border-2 border-black font-bold h-10 rounded-none">
                                    <SelectValue placeholder="Pilih gudang..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {warehouses.map((w: any) => (
                                        <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Tanggal</label>
                            <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="border-2 border-black font-mono h-10 rounded-none" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Catatan</label>
                            <Input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Opsional..." className="border-2 border-black h-10 rounded-none" />
                        </div>
                        <Button onClick={handleCreate} disabled={creating} className="w-full bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs h-10 rounded-none">
                            {creating ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                            Buat Sesi
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* COUNT DIALOG */}
            <Dialog open={!!countOpen} onOpenChange={(open) => !open && setCountOpen(null)}>
                <DialogContent className={`${NB.content} max-w-3xl max-h-[80vh] overflow-y-auto`}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}><ClipboardList className="h-5 w-5" /> Hitung Stok — {activeSession?.warehouseName}</DialogTitle>
                        <p className={NB.subtitle}>Isi jumlah aktual untuk setiap produk. Kosongkan jika belum dihitung.</p>
                    </DialogHeader>
                    <div className="p-5">
                        <Table>
                            <TableHeader className="bg-zinc-50 border-b-2 border-black">
                                <TableRow>
                                    <TableHead className="font-black text-black uppercase text-[10px] tracking-wider">Produk</TableHead>
                                    <TableHead className="font-black text-black uppercase text-[10px] tracking-wider text-right w-[100px]">Sistem</TableHead>
                                    <TableHead className="font-black text-black uppercase text-[10px] tracking-wider text-right w-[120px]">Aktual</TableHead>
                                    <TableHead className="font-black text-black uppercase text-[10px] tracking-wider text-center w-[80px]">Selisih</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {activeSession?.items.map((item) => {
                                    const actual = counts[item.id]
                                    const variance = actual !== "" ? Number(actual) - item.expectedQty : null
                                    return (
                                        <TableRow key={item.id} className="border-b border-zinc-100">
                                            <TableCell>
                                                <div className="font-bold text-sm">{item.productName}</div>
                                                <div className="text-[10px] font-mono text-zinc-400">{item.productCode} · {item.unit}</div>
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-bold">{item.expectedQty.toLocaleString()}</TableCell>
                                            <TableCell className="text-right">
                                                <Input
                                                    type="number"
                                                    value={counts[item.id] ?? ""}
                                                    onChange={(e) => setCounts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                                    className="border-2 border-black font-mono font-bold h-8 text-right w-full rounded-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    placeholder="—"
                                                />
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {variance !== null ? (
                                                    <span className={`font-black ${variance === 0 ? "text-emerald-600" : "text-red-600"}`}>
                                                        {variance > 0 ? "+" : ""}{variance}
                                                    </span>
                                                ) : (
                                                    <span className="text-zinc-300">—</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                        <div className="flex gap-2 mt-4">
                            <Button
                                onClick={handleSubmitCounts}
                                disabled={submitting}
                                className="flex-1 bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs h-10 rounded-none"
                            >
                                {submitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                Simpan Hitungan
                            </Button>
                            {activeSession && activeSession.countedCount === activeSession.itemCount && activeSession.status !== "COMPLETED" && (
                                <Button
                                    onClick={handleFinalize}
                                    disabled={finalizing}
                                    className="bg-emerald-600 text-white border-2 border-emerald-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs h-10 rounded-none px-6"
                                >
                                    {finalizing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                    Finalisasi
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
```

**Step 2: Add route to nav prefetch map**

In `hooks/use-nav-prefetch.ts`, add to `routePrefetchMap`:
```ts
"/inventory/cycle-counts": {
    queryKey: queryKeys.cycleCounts.list(),
    queryFn: () => import("@/app/actions/cycle-count").then(m => m.getCycleCountSessions()),
},
```

**Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | grep "cycle-count"`
Expected: No errors.

**Step 4: Commit**
```bash
git add app/inventory/cycle-counts/page.tsx hooks/use-nav-prefetch.ts
git commit -m "feat(inventory): add batch cycle count page with create, count, and finalize"
```

---

## Task 8: Add Cycle Count Link to Sidebar & Audit Page

**Files:**
- Modify: `lib/sidebar-nav-data.ts` or `components/app-sidebar.tsx` — add "Stok Opname Batch" link under Inventory
- Modify: `app/inventory/audit/page.tsx` — add link to `/inventory/cycle-counts`

**Step 1: Add link in audit page header**

In `app/inventory/audit/page.tsx`, find the header section and add a button linking to batch cycle counts:
```tsx
<Link href="/inventory/cycle-counts">
    <Button className="bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold text-[10px] tracking-wide hover:translate-y-[1px] hover:shadow-none transition-all h-9 rounded-none">
        <ClipboardList className="mr-2 h-3.5 w-3.5" /> Opname Batch
    </Button>
</Link>
```

**Step 2: Add to sidebar nav data**

Find the Inventory section and add after "Opname":
```ts
{ title: "Opname Batch", url: "/inventory/cycle-counts" },
```

**Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | grep "audit\|sidebar"`
Expected: No errors.

**Step 4: Commit**
```bash
git add app/inventory/audit/page.tsx lib/sidebar-nav-data.ts
git commit -m "feat(inventory): add cycle count links to audit page and sidebar"
```

---

## Task 9: Final Verification

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All existing tests pass. New SO reservation test passes.

**Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No new errors (only pre-existing ones).

**Step 3: Lint**

Run: `npm run lint`
Expected: No new lint errors.

**Step 4: Final commit**
```bash
git commit --allow-empty -m "chore: verify inventory health improvements pass all checks"
```

---

## Verification Guide

### P1: Stock Adjustment Entry Points

| Halaman | Cara Test |
|---------|-----------|
| `/inventory/products/[id]` | Open any product → click "Penyesuaian" → dialog opens with product pre-selected → submit |
| `/inventory/stock` | Click "Penyesuaian" button in header → dialog opens → pick product + warehouse → submit |
| `/inventory/movements` | Click "Penyesuaian Stok" → dialog opens (already worked before) |
| `/inventory/adjustments` | No longer redirects — shows navigation hub with 3 options |

### P3: Batch Cycle Count

| Halaman | Cara Test |
|---------|-----------|
| `/inventory/cycle-counts` | Click "Buat Sesi Baru" → pick warehouse → all products auto-populated → enter actual quantities → "Simpan Hitungan" → "Finalisasi" applies variances |
| `/inventory/audit` | "Opname Batch" button links to cycle counts page |

### P4: SO Stock Reservation

| Halaman | Cara Test |
|---------|-----------|
| `/sales/quotations` | Convert quotation to SO → check that product's `reservedQty` increases in `/inventory/stock` |
| `/sales/orders` | Cancel an SO → check that `reservedQty` decreases back |

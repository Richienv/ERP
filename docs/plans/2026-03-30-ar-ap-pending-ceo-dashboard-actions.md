# AR/AP Pending Section + CEO Dashboard Inline Actions + Real-Time Sync

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show DRAFT invoices in AR/AP pages with approve/reject actions (role-gated), add inline action popups to CEO dashboard "Tugas Hari Ini", and ensure all mutations sync across pages via TanStack Query invalidation.

**Architecture:** Extend existing `getARAgingReport()` / `getAPAgingReport()` to return a separate `pending` array of DRAFT invoices. Add a `<PendingApprovalSection>` component to both AR/AP client pages. Convert dashboard `TodaysTasks` from `Link` elements to popup-opening `div` elements with 6 dialog types. Use `queryClient.invalidateQueries()` after all mutations.

**Tech Stack:** React 19, TanStack Query, Next.js App Router, Prisma, shadcn/ui, NBDialog components, existing server actions.

---

## Task 1: Extend aging reports to include DRAFT invoices

**Files:**
- Modify: `lib/actions/finance.ts` — `getARAgingReport()` (~line 3622) and `getAPAgingReport()` (~line 3738)

**Step 1: Add DRAFT invoice query to `getARAgingReport()`**

After the existing `openInvoices` query (~line 3628), add a second query for DRAFT invoices:

```typescript
// After the existing openInvoices query, add:
const pendingInvoices = await basePrisma.invoice.findMany({
    where: {
        type: 'INV_OUT',
        status: 'DRAFT',
    },
    include: {
        customer: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: 'desc' },
})

const pending = pendingInvoices.map(inv => ({
    id: inv.id,
    invoiceNumber: inv.number,
    customerName: inv.customer?.name || 'Tanpa Pelanggan',
    customerId: inv.customer?.id || '',
    totalAmount: toNum(inv.totalAmount),
    createdAt: inv.createdAt,
    dueDate: inv.dueDate,
}))
```

Add `pending` to the return value:

```typescript
return {
    summary: { ... },  // unchanged — only ISSUED invoices
    byCustomer: [...],  // unchanged
    details: [...],     // unchanged
    pending,            // NEW: DRAFT invoices awaiting approval
}
```

Also add `pending: []` to the error fallback return.

**Step 2: Add DRAFT invoice query to `getAPAgingReport()`**

Same pattern but for `INV_IN`:

```typescript
const pendingBills = await basePrisma.invoice.findMany({
    where: {
        type: 'INV_IN',
        status: 'DRAFT',
    },
    include: {
        supplier: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: 'desc' },
})

const pending = pendingBills.map(bill => ({
    id: bill.id,
    invoiceNumber: bill.number,
    supplierName: bill.supplier?.name || 'Tanpa Supplier',
    supplierId: bill.supplier?.id || '',
    totalAmount: toNum(bill.totalAmount),
    createdAt: bill.createdAt,
    dueDate: bill.dueDate,
}))
```

Add `pending` to return and error fallback.

**Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | grep finance.ts`
Expected: No new errors.

**Step 4: Commit**

```bash
git add lib/actions/finance.ts
git commit -m "feat: extend AR/AP aging reports to include DRAFT invoices as pending"
```

---

## Task 2: Create `<PendingApprovalSection>` component

**Files:**
- Create: `components/finance/pending-approval-section.tsx`

**Step 1: Create the component**

This component shows DRAFT invoices in an amber-bordered card with SETUJUI/TOLAK buttons (role-gated).

```tsx
"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/lib/auth-context"
import { queryKeys } from "@/lib/query-keys"
import { moveInvoiceToSent } from "@/lib/actions/finance-invoices"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { AlertTriangle, Check, X, Loader2, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

// Roles allowed to approve/reject invoices
const APPROVER_ROLES = ["ROLE_CEO", "CEO", "ROLE_DIRECTOR", "DIRECTOR", "OWNER", "ROLE_OWNER", "FINANCE_MANAGER", "ROLE_ACCOUNTANT", "ACCOUNTANT"]

interface PendingItem {
    id: string
    invoiceNumber: string
    customerName?: string
    supplierName?: string
    customerId?: string
    supplierId?: string
    totalAmount: number
    createdAt: Date | string
    dueDate: Date | string | null
}

interface PendingApprovalSectionProps {
    items: PendingItem[]
    type: "AR" | "AP"  // AR = customer invoices, AP = vendor bills
}

export function PendingApprovalSection({ items, type }: PendingApprovalSectionProps) {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [processingId, setProcessingId] = useState<string | null>(null)

    if (!items || items.length === 0) return null

    const canApprove = user?.role && APPROVER_ROLES.includes(user.role.toUpperCase())

    const totalPending = items.reduce((sum, item) => sum + item.totalAmount, 0)
    const partyLabel = type === "AR" ? "Pelanggan" : "Supplier"

    const handleApprove = async (item: PendingItem) => {
        setProcessingId(item.id)
        try {
            const result = await moveInvoiceToSent(item.id)
            if (!result.success) throw new Error((result as any).error || "Gagal menyetujui")
            toast.success(`${item.invoiceNumber} disetujui & diterbitkan`)
            queryClient.invalidateQueries({ queryKey: ["finance", "ar-aging"] })
            queryClient.invalidateQueries({ queryKey: ["finance", "ap-aging"] })
            queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all })
        } catch (error: any) {
            toast.error(error.message || "Gagal menyetujui invoice")
        } finally {
            setProcessingId(null)
        }
    }

    const handleReject = async (item: PendingItem) => {
        const reason = window.prompt("Alasan penolakan:")
        if (reason === null) return // cancelled
        setProcessingId(item.id)
        try {
            const { prisma } = await import("@/lib/db")
            // We can't use prisma directly from client. Use a server action instead.
            // For now, call a simple update via a server action
            const { cancelInvoice } = await import("@/lib/actions/finance-invoices")
            const result = await cancelInvoice(item.id, reason || "Ditolak oleh manajemen")
            if (!result.success) throw new Error((result as any).error || "Gagal menolak")
            toast.success(`${item.invoiceNumber} ditolak`)
            queryClient.invalidateQueries({ queryKey: ["finance", "ar-aging"] })
            queryClient.invalidateQueries({ queryKey: ["finance", "ap-aging"] })
            queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all })
        } catch (error: any) {
            toast.error(error.message || "Gagal menolak invoice")
        } finally {
            setProcessingId(null)
        }
    }

    const fmt = (d: Date | string | null) => {
        if (!d) return "-"
        return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
    }

    return (
        <div className="border-2 border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-700 shadow-[3px_3px_0px_0px_rgba(217,119,6,0.3)] overflow-hidden">
            {/* Header */}
            <div className="px-4 py-2.5 flex items-center justify-between border-b border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
                        Menunggu Persetujuan ({items.length})
                    </span>
                </div>
                <span className="text-sm font-black font-mono text-amber-700 dark:text-amber-400">
                    {formatIDR(totalPending)}
                </span>
            </div>

            {/* Items */}
            <div className="divide-y divide-amber-200/50 dark:divide-amber-800/50">
                {items.map((item) => (
                    <div key={item.id} className="px-4 py-2.5 flex items-center gap-4">
                        <FileText className="h-4 w-4 text-amber-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black font-mono text-zinc-900 dark:text-white">
                                    {item.invoiceNumber}
                                </span>
                                <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 bg-amber-200/60 text-amber-700 dark:bg-amber-800/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                    DRAFT
                                </span>
                            </div>
                            <div className="text-[10px] text-zinc-500 font-medium mt-0.5">
                                {type === "AR" ? item.customerName : item.supplierName}
                                {item.dueDate && <> &middot; Jatuh tempo {fmt(item.dueDate)}</>}
                            </div>
                        </div>
                        <span className="text-sm font-black font-mono text-zinc-900 dark:text-white shrink-0">
                            {formatIDR(item.totalAmount)}
                        </span>
                        {canApprove ? (
                            <div className="flex items-center gap-1 shrink-0">
                                <Button
                                    size="sm"
                                    disabled={processingId === item.id}
                                    onClick={() => handleApprove(item)}
                                    className="h-7 px-2.5 text-[9px] font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white rounded-none border border-emerald-700 gap-1"
                                >
                                    {processingId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                    Setujui
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={processingId === item.id}
                                    onClick={() => handleReject(item)}
                                    className="h-7 px-2.5 text-[9px] font-black uppercase tracking-wider text-red-600 hover:bg-red-50 border-red-300 rounded-none gap-1"
                                >
                                    <X className="h-3 w-3" />
                                    Tolak
                                </Button>
                            </div>
                        ) : (
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                                Menunggu persetujuan
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
```

**Step 2: Ensure `cancelInvoice` server action exists**

Check `lib/actions/finance-invoices.ts` for a function that cancels/voids an invoice. If it doesn't exist, create one:

```typescript
export async function cancelInvoice(invoiceId: string, reason?: string) {
    try {
        await withPrismaAuth(async (prisma) => {
            const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { status: true, number: true } })
            if (!inv) throw new Error("Invoice not found")
            if (inv.status !== 'DRAFT') throw new Error(`Invoice ${inv.number} sudah berstatus ${inv.status}, tidak bisa ditolak`)
            await prisma.invoice.update({
                where: { id: invoiceId },
                data: { status: 'CANCELLED', notes: reason || 'Ditolak' },
            })
        })
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
```

**Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | grep pending-approval`
Expected: No errors.

**Step 4: Commit**

```bash
git add components/finance/pending-approval-section.tsx lib/actions/finance-invoices.ts
git commit -m "feat: create PendingApprovalSection component with role-gated approve/reject"
```

---

## Task 3: Add pending section to AR page

**Files:**
- Modify: `app/finance/receivables/receivables-client.tsx`

**Step 1: Add import and render the pending section**

Add import at top:
```typescript
import { PendingApprovalSection } from "@/components/finance/pending-approval-section"
```

After the closing `</motion.div>` of the page header (after the KPI strip, ~line 111), add:

```tsx
{/* ─── Pending Approval Section ─── */}
{aging?.pending && aging.pending.length > 0 && (
    <PendingApprovalSection items={aging.pending} type="AR" />
)}
```

This renders between the header card and the tab content.

**Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | grep receivables`
Expected: No errors.

**Step 3: Commit**

```bash
git add app/finance/receivables/receivables-client.tsx
git commit -m "feat: show DRAFT invoices in AR pending approval section"
```

---

## Task 4: Add pending section to AP page

**Files:**
- Modify: `app/finance/payables/payables-client.tsx`

**Step 1: Add import and render the pending section**

Add import at top:
```typescript
import { PendingApprovalSection } from "@/components/finance/pending-approval-section"
```

After the closing `</motion.div>` of the page header (~line 117), add:

```tsx
{/* ─── Pending Approval Section ─── */}
{aging?.pending && aging.pending.length > 0 && (
    <PendingApprovalSection items={aging.pending} type="AP" />
)}
```

**Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | grep payables`
Expected: No errors.

**Step 3: Commit**

```bash
git add app/finance/payables/payables-client.tsx
git commit -m "feat: show DRAFT bills in AP pending approval section"
```

---

## Task 5: Add invoice counts to sidebar action-counts API

**Files:**
- Modify: `app/api/sidebar/action-counts/route.ts`
- Modify: `hooks/use-sidebar-actions.ts`

**Step 1: Add DRAFT invoice count query to API**

In the `Promise.allSettled` array (~line 9), add a 7th query:

```typescript
// 7. Draft invoices awaiting approval
prisma.invoice.count({
    where: {
        status: "DRAFT",
    },
}),
```

After the existing `pendingApprovals` extraction (~line 102), add:

```typescript
const pendingInvoices = valueOf(results[6], 0)
```

Add to the JSON response:

```typescript
return NextResponse.json({
    vendorsIncomplete,
    productsIncomplete,
    customersIncomplete,
    lowStockProducts,
    pendingPurchaseRequests,
    pendingApprovals,
    pendingInvoices,  // NEW
})
```

Also add `pendingInvoices: 0` to the error fallback response.

**Step 2: Update `SidebarActionCounts` interface**

In `hooks/use-sidebar-actions.ts`, add to the interface:

```typescript
export interface SidebarActionCounts {
    vendorsIncomplete: number
    productsIncomplete: number
    customersIncomplete: number
    lowStockProducts: number
    pendingPurchaseRequests: number
    pendingApprovals: number
    pendingInvoices: number  // NEW
}
```

**Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | grep -E "sidebar|action-counts"`
Expected: No errors.

**Step 4: Commit**

```bash
git add app/api/sidebar/action-counts/route.ts hooks/use-sidebar-actions.ts
git commit -m "feat: add pendingInvoices count to sidebar action-counts API"
```

---

## Task 6: Create dashboard action popup components

**Files:**
- Create: `components/dashboard/popups/po-approval-popup.tsx`
- Create: `components/dashboard/popups/pr-approval-popup.tsx`
- Create: `components/dashboard/popups/vendor-quick-edit-popup.tsx`
- Create: `components/dashboard/popups/product-quick-edit-popup.tsx`
- Create: `components/dashboard/popups/low-stock-popup.tsx`
- Create: `components/dashboard/popups/invoice-approval-popup.tsx`
- Create: `components/dashboard/task-action-dialog.tsx`

**Step 1: Create PO Approval Popup**

`components/dashboard/popups/po-approval-popup.tsx`:

```tsx
"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { NBDialog, NBDialogHeader, NBDialogBody, NBSection } from "@/components/ui/nb-dialog"
import { approvePurchaseOrder, rejectPurchaseOrder } from "@/lib/actions/procurement"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Loader2, ShieldCheck, FileText, Building2, Package } from "lucide-react"
import { prisma } from "@/lib/db"

interface POApprovalPopupProps {
    open: boolean
    onClose: () => void
}

export function POApprovalPopup({ open, onClose }: POApprovalPopupProps) {
    const [pos, setPOs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState<string | null>(null)
    const queryClient = useQueryClient()

    useEffect(() => {
        if (open) fetchPOs()
    }, [open])

    const fetchPOs = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/dashboard/pending-pos")
            const data = await res.json()
            setPOs(data.pos || [])
        } catch {
            toast.error("Gagal memuat data PO")
        } finally {
            setLoading(false)
        }
    }

    const handleApprove = async (poId: string) => {
        setProcessingId(poId)
        try {
            const result = await approvePurchaseOrder(poId)
            if (!result.success) throw new Error((result as any).error)
            toast.success("PO disetujui")
            setPOs(prev => prev.filter(p => p.id !== poId))
            queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all })
            if (pos.length <= 1) onClose()
        } catch (error: any) {
            toast.error(error.message || "Gagal menyetujui PO")
        } finally {
            setProcessingId(null)
        }
    }

    const handleReject = async (poId: string) => {
        const reason = window.prompt("Alasan penolakan:")
        if (reason === null) return
        setProcessingId(poId)
        try {
            const result = await rejectPurchaseOrder(poId, reason || "Ditolak")
            if (!result.success) throw new Error((result as any).error)
            toast.success("PO ditolak")
            setPOs(prev => prev.filter(p => p.id !== poId))
            queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all })
            if (pos.length <= 1) onClose()
        } catch (error: any) {
            toast.error(error.message || "Gagal menolak PO")
        } finally {
            setProcessingId(null)
        }
    }

    return (
        <NBDialog open={open} onOpenChange={onClose}>
            <NBDialogHeader icon={ShieldCheck} title="Persetujuan PO" subtitle="Setujui atau tolak pesanan pembelian" />
            <NBDialogBody>
                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-zinc-300" /></div>
                ) : pos.length === 0 ? (
                    <div className="text-center py-8 text-zinc-400 text-sm font-bold">Tidak ada PO menunggu persetujuan</div>
                ) : (
                    <div className="space-y-3">
                        {pos.map(po => (
                            <NBSection key={po.id} icon={FileText} title={po.number}>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2 text-zinc-600">
                                            <Building2 className="h-3.5 w-3.5" />
                                            <span className="font-bold">{po.supplierName}</span>
                                        </div>
                                        <span className="font-black font-mono">{formatIDR(po.totalAmount)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                                        <Package className="h-3 w-3" />
                                        <span>{po.itemCount} item &middot; {new Date(po.orderDate).toLocaleDateString("id-ID")}</span>
                                    </div>
                                    <div className="flex justify-end gap-2 pt-1">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={!!processingId}
                                            onClick={() => handleReject(po.id)}
                                            className="h-7 px-3 text-[9px] font-black uppercase tracking-wider text-red-600 border-red-300 rounded-none"
                                        >
                                            Tolak
                                        </Button>
                                        <Button
                                            size="sm"
                                            disabled={!!processingId}
                                            onClick={() => handleApprove(po.id)}
                                            className="h-7 px-3 text-[9px] font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white rounded-none border border-emerald-700"
                                        >
                                            {processingId === po.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                            Setujui
                                        </Button>
                                    </div>
                                </div>
                            </NBSection>
                        ))}
                    </div>
                )}
            </NBDialogBody>
        </NBDialog>
    )
}
```

**Step 2: Create Invoice Approval Popup**

`components/dashboard/popups/invoice-approval-popup.tsx`:

Similar pattern to PO Approval but fetches DRAFT invoices and calls `moveInvoiceToSent()` / `cancelInvoice()`. Fetches from `/api/dashboard/pending-invoices`. Shows invoice number, customer/supplier name, amount, type badge (AR/AP).

**Step 3: Create remaining popup stubs**

For PR Approval, Vendor Quick-Edit, Product Quick-Edit, and Low Stock — follow the same NBDialog pattern:
- PR Approval: fetch pending PRs, approve/reject buttons
- Vendor Quick-Edit: fetch incomplete vendors, inline form for missing fields (phone, email, address)
- Product Quick-Edit: fetch incomplete products, inline form for missing fields (costPrice, categoryId)
- Low Stock: fetch low-stock products, show current vs min stock, "Lihat Detail" link button

**Step 4: Create the TaskActionDialog switch component**

`components/dashboard/task-action-dialog.tsx`:

```tsx
"use client"

import dynamic from "next/dynamic"

const POApprovalPopup = dynamic(() => import("./popups/po-approval-popup").then(m => ({ default: m.POApprovalPopup })), { ssr: false })
const PRApprovalPopup = dynamic(() => import("./popups/pr-approval-popup").then(m => ({ default: m.PRApprovalPopup })), { ssr: false })
const VendorQuickEditPopup = dynamic(() => import("./popups/vendor-quick-edit-popup").then(m => ({ default: m.VendorQuickEditPopup })), { ssr: false })
const ProductQuickEditPopup = dynamic(() => import("./popups/product-quick-edit-popup").then(m => ({ default: m.ProductQuickEditPopup })), { ssr: false })
const LowStockPopup = dynamic(() => import("./popups/low-stock-popup").then(m => ({ default: m.LowStockPopup })), { ssr: false })
const InvoiceApprovalPopup = dynamic(() => import("./popups/invoice-approval-popup").then(m => ({ default: m.InvoiceApprovalPopup })), { ssr: false })

export type TaskType = "low-stock" | "pending-approvals" | "pending-pr" | "vendors-incomplete" | "products-incomplete" | "customers-incomplete" | "pending-invoices"

interface TaskActionDialogProps {
    taskType: TaskType | null
    open: boolean
    onClose: () => void
}

export function TaskActionDialog({ taskType, open, onClose }: TaskActionDialogProps) {
    if (!taskType || !open) return null

    switch (taskType) {
        case "pending-approvals":
            return <POApprovalPopup open={open} onClose={onClose} />
        case "pending-pr":
            return <PRApprovalPopup open={open} onClose={onClose} />
        case "vendors-incomplete":
            return <VendorQuickEditPopup open={open} onClose={onClose} />
        case "products-incomplete":
        case "customers-incomplete":
            return <ProductQuickEditPopup open={open} onClose={onClose} taskType={taskType} />
        case "low-stock":
            return <LowStockPopup open={open} onClose={onClose} />
        case "pending-invoices":
            return <InvoiceApprovalPopup open={open} onClose={onClose} />
        default:
            return null
    }
}
```

**Step 5: Commit**

```bash
git add components/dashboard/popups/ components/dashboard/task-action-dialog.tsx
git commit -m "feat: create 6 dashboard action popup components with TaskActionDialog switch"
```

---

## Task 7: Create API endpoints for dashboard popups

**Files:**
- Create: `app/api/dashboard/pending-pos/route.ts`
- Create: `app/api/dashboard/pending-invoices/route.ts`
- Create: `app/api/dashboard/pending-prs/route.ts`
- Create: `app/api/dashboard/incomplete-vendors/route.ts`
- Create: `app/api/dashboard/incomplete-products/route.ts`
- Create: `app/api/dashboard/low-stock-products/route.ts`

**Step 1: Create pending POs endpoint**

`app/api/dashboard/pending-pos/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const pos = await prisma.purchaseOrder.findMany({
            where: { status: "PENDING_APPROVAL" },
            include: {
                supplier: { select: { name: true } },
                items: { select: { id: true } },
            },
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json({
            pos: pos.map(po => ({
                id: po.id,
                number: po.number,
                supplierName: po.supplier?.name || "Tanpa Vendor",
                totalAmount: Number(po.netAmount || po.totalAmount),
                itemCount: po.items.length,
                orderDate: po.orderDate,
            })),
        })
    } catch (error) {
        console.error("[API] pending-pos error:", error)
        return NextResponse.json({ pos: [] }, { status: 500 })
    }
}
```

**Step 2: Create pending invoices endpoint**

`app/api/dashboard/pending-invoices/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const invoices = await prisma.invoice.findMany({
            where: { status: "DRAFT" },
            include: {
                customer: { select: { name: true } },
                supplier: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json({
            invoices: invoices.map(inv => ({
                id: inv.id,
                number: inv.number,
                type: inv.type,
                partyName: inv.type === "INV_OUT" ? (inv.customer?.name || "Tanpa Pelanggan") : (inv.supplier?.name || "Tanpa Supplier"),
                totalAmount: Number(inv.totalAmount),
                createdAt: inv.createdAt,
                dueDate: inv.dueDate,
            })),
        })
    } catch (error) {
        console.error("[API] pending-invoices error:", error)
        return NextResponse.json({ invoices: [] }, { status: 500 })
    }
}
```

**Step 3: Create remaining endpoints**

Follow the same pattern for PRs, incomplete vendors, incomplete products, and low-stock products. Each returns a compact list suitable for popup display.

**Step 4: Commit**

```bash
git add app/api/dashboard/
git commit -m "feat: create 6 dashboard popup API endpoints"
```

---

## Task 8: Convert TodaysTasks from Link to popup-opening divs

**Files:**
- Modify: `components/dashboard/todays-tasks.tsx`

**Step 1: Add invoice task and dialog state**

Update the component to:

1. Add `pendingInvoices` task item when count > 0
2. Replace `Link` with clickable `div` that opens `TaskActionDialog`
3. Add dialog state management

Replace the entire component. Key changes:
- Import `TaskActionDialog` and its `TaskType`
- Add `useState<TaskType | null>(null)` for active popup
- Add `pendingInvoices` task item (priority: "warning", icon: FileText)
- Change `<Link href={task.href}>` to `<div onClick={() => setActiveTask(task.id as TaskType)} className="cursor-pointer ...">`
- Render `<TaskActionDialog taskType={activeTask} open={!!activeTask} onClose={() => setActiveTask(null)} />`

**Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | grep todays-tasks`
Expected: No errors.

**Step 3: Commit**

```bash
git add components/dashboard/todays-tasks.tsx
git commit -m "feat: convert TodaysTasks to popup-opening divs with TaskActionDialog"
```

---

## Task 9: Query invalidation helper

**Files:**
- Create: `lib/invalidate-finance.ts`

**Step 1: Create shared invalidation helper**

```typescript
import { QueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function invalidateFinanceQueries(queryClient: QueryClient) {
    queryClient.invalidateQueries({ queryKey: ["finance", "ar-aging"] })
    queryClient.invalidateQueries({ queryKey: ["finance", "ap-aging"] })
    queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all })
}

export function invalidateProcurementQueries(queryClient: QueryClient) {
    queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all })
}
```

**Step 2: Use in PendingApprovalSection and popup components**

Replace the manual `invalidateQueries` calls with `invalidateFinanceQueries(queryClient)`.

**Step 3: Commit**

```bash
git add lib/invalidate-finance.ts
git commit -m "feat: add shared query invalidation helpers for finance and procurement"
```

---

## Task 10: Integration testing and verification

**Step 1: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No new errors in modified files.

**Step 2: Lint**

Run: `npm run lint`
Expected: Clean or only pre-existing warnings.

**Step 3: Manual verification**

1. **AR Pending Section:**
   - Navigate to `/finance/receivables`
   - If DRAFT customer invoices exist, the amber "Menunggu Persetujuan" card appears above tabs
   - Aging KPI strip only shows ISSUED invoice totals (not DRAFT)
   - As CEO/OWNER: SETUJUI/TOLAK buttons visible
   - As STAFF: "Menunggu persetujuan" text instead of buttons

2. **AP Pending Section:**
   - Navigate to `/finance/payables`
   - Same behavior for DRAFT vendor bills

3. **Dashboard Inline Actions:**
   - Navigate to `/dashboard`
   - "Tugas Hari Ini" shows items including "X invoice menunggu persetujuan"
   - Clicking a task opens an NBDialog popup
   - PO approval popup: shows PO details, SETUJUI/TOLAK buttons
   - After approving: popup updates, dashboard counter decrements

4. **Real-Time Sync:**
   - Approve a DRAFT invoice from AR page
   - Dashboard "Tugas Hari Ini" counter should decrement within 30s (or immediately if you navigate)
   - Invoice Center should show the invoice as ISSUED

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: AR/AP pending approval section, CEO dashboard inline actions, real-time sync"
```

---

## Implementation Order Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Extend aging reports with DRAFT invoices | `lib/actions/finance.ts` |
| 2 | Create PendingApprovalSection component | `components/finance/pending-approval-section.tsx`, `lib/actions/finance-invoices.ts` |
| 3 | Add pending section to AR page | `app/finance/receivables/receivables-client.tsx` |
| 4 | Add pending section to AP page | `app/finance/payables/payables-client.tsx` |
| 5 | Add invoice counts to sidebar API | `app/api/sidebar/action-counts/route.ts`, `hooks/use-sidebar-actions.ts` |
| 6 | Create 6 dashboard popup components | `components/dashboard/popups/*.tsx`, `components/dashboard/task-action-dialog.tsx` |
| 7 | Create 6 API endpoints for popups | `app/api/dashboard/*.ts` |
| 8 | Convert TodaysTasks to popup mode | `components/dashboard/todays-tasks.tsx` |
| 9 | Query invalidation helper | `lib/invalidate-finance.ts` |
| 10 | Integration testing | All files |

## Key Design Decisions

- **Role gating**: SETUJUI/TOLAK buttons only for `ROLE_CEO`, `CEO`, `DIRECTOR`, `OWNER`, `FINANCE_MANAGER`, `ACCOUNTANT`
- **Approve = moveInvoiceToSent()**: DRAFT → ISSUED, creates GL entries
- **Reject = cancelInvoice()**: DRAFT → CANCELLED
- **Aging KPIs unchanged**: Only count ISSUED/PARTIAL/OVERDUE
- **Popup data lazy-loaded**: API calls only when popup opens
- **No new DB models**: Uses existing Invoice, PurchaseOrder, PurchaseRequest models

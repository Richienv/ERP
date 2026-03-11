# CEO Dashboard Action System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let the CEO flag/poke items on the dashboard with an optional note, routing in-app notifications to the responsible department's staff.

**Architecture:** New `CeoFlag` Prisma model stores flags. A `FlagButton` popover component on dashboard items lets CEO send flags. The existing `NotificationCenter` bell in `site-header.tsx` is upgraded to show CEO flags alongside existing smart counts. Routing is role-based via `Employee.department` matching.

**Tech Stack:** Prisma migration, server actions (`lib/actions/ceo-flags.ts`), TanStack Query hook (`hooks/use-ceo-flags.ts`), React popover component (`components/dashboard/flag-button.tsx`), upgraded `components/notification-center.tsx`.

---

## Task 1: Prisma Model — CeoFlag

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add CeoFlag model to schema**

Add at end of schema (before any trailing comments):

```prisma
enum FlagStatus {
  PENDING
  READ
  ACTED
  DISMISSED
  @@map("flag_status")
}

model CeoFlag {
  id          String     @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  title       String     // Auto-generated: "Invoice INV-001 overdue"
  note        String?    // Optional CEO note
  targetDept  String     // "Finance", "Warehouse", "Manufacturing", "HR", "Procurement"
  sourceType  String     // "INVOICE", "PO", "WORK_ORDER", "PRODUCT", "EMPLOYEE", "JOURNAL", "SALES_ORDER", "EXPENSE"
  sourceId    String     // The item's database ID
  sourceLabel String     // Human-readable: "INV-2026-001" or "PO-2026-001"
  status      FlagStatus @default(PENDING)
  createdBy   String     @db.Uuid // User ID of CEO
  readBy      String?    @db.Uuid // Employee who read it
  readAt      DateTime?
  actedAt     DateTime?
  createdAt   DateTime   @default(now())

  @@index([targetDept, status])
  @@index([sourceType, sourceId])
  @@index([createdAt])
  @@map("ceo_flags")
}
```

**Step 2: Create migration**

Run: `npx prisma migrate dev --name add_ceo_flags`

**Step 3: Regenerate client**

Run: `npx prisma generate`

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add CeoFlag model for dashboard action system"
```

---

## Task 2: Server Actions — Create & Read Flags

**Files:**
- Create: `lib/actions/ceo-flags.ts`

**Step 1: Create the server actions file**

```typescript
"use server"

import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// Routing map: sourceType → department
const ROUTING_MAP: Record<string, string> = {
    INVOICE: "Finance",
    JOURNAL: "Finance",
    EXPENSE: "Finance",
    PO: "Procurement",
    PR: "Procurement",
    PRODUCT: "Warehouse",
    STOCK: "Warehouse",
    WORK_ORDER: "Manufacturing",
    MACHINE: "Manufacturing",
    QUALITY: "Manufacturing",
    EMPLOYEE: "HR",
    ATTENDANCE: "HR",
    LEAVE: "HR",
    SALES_ORDER: "Sales",
    CUSTOMER: "Sales",
}

export async function createCeoFlag(input: {
    title: string
    note?: string
    sourceType: string
    sourceId: string
    sourceLabel: string
}) {
    const user = await requireAuth()

    const targetDept = ROUTING_MAP[input.sourceType] ?? "Finance"

    const flag = await prisma.ceoFlag.create({
        data: {
            title: input.title,
            note: input.note || null,
            targetDept,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            sourceLabel: input.sourceLabel,
            createdBy: user.id,
        },
    })

    return { success: true, flagId: flag.id }
}

export async function getCeoFlags(options?: { targetDept?: string; status?: string; limit?: number }) {
    await requireAuth()

    const flags = await prisma.ceoFlag.findMany({
        where: {
            ...(options?.targetDept ? { targetDept: options.targetDept } : {}),
            ...(options?.status ? { status: options.status as any } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: options?.limit ?? 20,
    })

    return flags.map(f => ({
        id: f.id,
        title: f.title,
        note: f.note,
        targetDept: f.targetDept,
        sourceType: f.sourceType,
        sourceId: f.sourceId,
        sourceLabel: f.sourceLabel,
        status: f.status,
        createdAt: f.createdAt.toISOString(),
        readAt: f.readAt?.toISOString() ?? null,
        actedAt: f.actedAt?.toISOString() ?? null,
    }))
}

export async function markFlagRead(flagId: string) {
    const user = await requireAuth()

    await prisma.ceoFlag.update({
        where: { id: flagId },
        data: { status: "READ", readBy: user.id, readAt: new Date() },
    })

    return { success: true }
}

export async function markFlagActed(flagId: string) {
    const user = await requireAuth()

    await prisma.ceoFlag.update({
        where: { id: flagId },
        data: { status: "ACTED", actedAt: new Date() },
    })

    return { success: true }
}

export async function dismissFlag(flagId: string) {
    await requireAuth()

    await prisma.ceoFlag.update({
        where: { id: flagId },
        data: { status: "DISMISSED" },
    })

    return { success: true }
}

export async function getPendingFlagCount() {
    await requireAuth()
    return prisma.ceoFlag.count({ where: { status: "PENDING" } })
}
```

**Step 2: Commit**

```bash
git add lib/actions/ceo-flags.ts
git commit -m "feat: add CEO flag server actions (create, read, mark, dismiss)"
```

---

## Task 3: TanStack Query Hook — useCeoFlags

**Files:**
- Create: `hooks/use-ceo-flags.ts`
- Modify: `lib/query-keys.ts` — add `ceoFlags` key factory

**Step 1: Add query keys**

In `lib/query-keys.ts`, add to the `queryKeys` object:

```typescript
ceoFlags: {
    all: ["ceo-flags"] as const,
    list: (filters?: Record<string, string>) => [...queryKeys.ceoFlags.all, "list", filters ?? {}] as const,
    count: () => [...queryKeys.ceoFlags.all, "count"] as const,
},
```

**Step 2: Create the hook**

```typescript
"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
    getCeoFlags,
    createCeoFlag,
    markFlagRead,
    markFlagActed,
    dismissFlag,
    getPendingFlagCount,
} from "@/lib/actions/ceo-flags"

export function useCeoFlags(options?: { targetDept?: string; status?: string; limit?: number }) {
    return useQuery({
        queryKey: queryKeys.ceoFlags.list(options as any),
        queryFn: () => getCeoFlags(options),
    })
}

export function usePendingFlagCount() {
    return useQuery({
        queryKey: queryKeys.ceoFlags.count(),
        queryFn: () => getPendingFlagCount(),
        refetchInterval: 30_000, // refresh every 30s
    })
}

export function useCreateFlag() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: createCeoFlag,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.ceoFlags.all })
        },
    })
}

export function useMarkFlagRead() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: markFlagRead,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.ceoFlags.all })
        },
    })
}

export function useMarkFlagActed() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: markFlagActed,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.ceoFlags.all })
        },
    })
}

export function useDismissFlag() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: dismissFlag,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.ceoFlags.all })
        },
    })
}
```

**Step 3: Commit**

```bash
git add lib/query-keys.ts hooks/use-ceo-flags.ts
git commit -m "feat: add useCeoFlags hook and query keys"
```

---

## Task 4: FlagButton Component

**Files:**
- Create: `components/dashboard/flag-button.tsx`

**Step 1: Create the FlagButton popover component**

This is a small flag icon that appears on actionable items. On click, it opens a popover with auto-generated title, optional textarea for CEO note, and a "Kirim" button.

```tsx
"use client"

import { useState } from "react"
import { IconFlag, IconFlagFilled, IconSend } from "@tabler/icons-react"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { useCreateFlag } from "@/hooks/use-ceo-flags"
import { toast } from "sonner"

interface FlagButtonProps {
    title: string        // Auto-generated: "Invoice INV-001 overdue"
    sourceType: string   // "INVOICE", "PO", etc.
    sourceId: string     // Database ID
    sourceLabel: string  // Human-readable: "INV-2026-001"
}

export function FlagButton({ title, sourceType, sourceId, sourceLabel }: FlagButtonProps) {
    const [open, setOpen] = useState(false)
    const [note, setNote] = useState("")
    const [flagged, setFlagged] = useState(false)
    const createFlag = useCreateFlag()

    const handleSend = async () => {
        try {
            await createFlag.mutateAsync({
                title,
                note: note.trim() || undefined,
                sourceType,
                sourceId,
                sourceLabel,
            })
            setFlagged(true)
            setOpen(false)
            setNote("")
            toast.success("Flag terkirim ke tim terkait")
        } catch {
            toast.error("Gagal mengirim flag")
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={`p-0.5 transition-colors shrink-0 ${
                        flagged
                            ? "text-orange-500"
                            : "text-zinc-300 hover:text-orange-500 opacity-0 group-hover:opacity-100"
                    }`}
                    aria-label="Flag item"
                >
                    {flagged
                        ? <IconFlagFilled className="w-3.5 h-3.5" />
                        : <IconFlag className="w-3.5 h-3.5" />}
                </button>
            </PopoverTrigger>
            <PopoverContent
                side="left"
                align="start"
                sideOffset={8}
                className="w-72 p-0 rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-700">
                    <p className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Flag ke Tim</p>
                    <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 truncate">{title}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{sourceLabel}</p>
                </div>
                <div className="p-3 space-y-2">
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Catatan (opsional)..."
                        className="w-full h-16 text-[12px] border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 resize-none focus:outline-none focus:border-black dark:focus:border-zinc-500 placeholder:text-zinc-300"
                    />
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={createFlag.isPending}
                        className="w-full flex items-center justify-center gap-1.5 py-2 bg-orange-500 border-2 border-black text-white text-[11px] font-black uppercase tracking-wider hover:bg-orange-600 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
                    >
                        <IconSend className="w-3.5 h-3.5" />
                        {createFlag.isPending ? "Mengirim..." : "Kirim Flag"}
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    )
}
```

**Step 2: Commit**

```bash
git add components/dashboard/flag-button.tsx
git commit -m "feat: add FlagButton popover component for CEO dashboard actions"
```

---

## Task 5: Add FlagButtons to Dashboard Cards

**Files:**
- Modify: `app/dashboard/page.tsx`

**Step 1: Import FlagButton**

```typescript
import { FlagButton } from "@/components/dashboard/flag-button"
```

**Step 2: Add FlagButton to actionable items in each card**

For every row that currently shows a link or item, add a `FlagButton` next to it. The parent container needs `group` class so the flag appears on hover. Each card gets flags on specific items:

**Penjualan** — recent orders:
```tsx
// In the recentOrders map, add after the amount span:
<FlagButton
    title={`Follow up pesanan ${order.customer}`}
    sourceType="SALES_ORDER"
    sourceId={order.id}
    sourceLabel={order.customer}
/>
```

**Inventori** — low stock items:
```tsx
// In the materialStatus map (Perlu Restock), add after the quantity:
<FlagButton
    title={`Stok rendah: ${item.name || item.product}`}
    sourceType="STOCK"
    sourceId={item.id || `stock-${i}`}
    sourceLabel={item.name || item.product || `Item ${i + 1}`}
/>
```

**Keuangan** — overdue invoices:
```tsx
// In the overdueInvoices map, add after the amount:
<FlagButton
    title={`Invoice overdue: ${inv.customer || inv.number}`}
    sourceType="INVOICE"
    sourceId={inv.id || `inv-${i}`}
    sourceLabel={inv.customer || inv.number || `INV-${i + 1}`}
/>
```

**Keuangan** — upcoming payables:
```tsx
// In the upcomingPayables map, add after amount:
<FlagButton
    title={`Tagihan mendatang: ${bill.supplier || bill.vendor || bill.number}`}
    sourceType="INVOICE"
    sourceId={bill.id || `bill-${i}`}
    sourceLabel={bill.supplier || bill.vendor || bill.number || `Bill-${i + 1}`}
/>
```

**Manufaktur** — recent work orders (stalled/late):
```tsx
// In mfgRecentOrders map, add to the header line:
<FlagButton
    title={`Work order butuh perhatian: ${wo.number}`}
    sourceType="WORK_ORDER"
    sourceId={wo.id}
    sourceLabel={wo.number}
/>
```

**Manufaktur** — failed inspections:
```tsx
// In mfgRecentInspections map (only for FAIL), add:
{insp.status !== "PASS" && (
    <FlagButton
        title={`Inspeksi gagal: ${insp.material || insp.batchNumber}`}
        sourceType="QUALITY"
        sourceId={insp.id || `insp-${i}`}
        sourceLabel={insp.material || insp.batchNumber}
    />
)}
```

**SDM** — late employees:
```tsx
// In lateEmployees map, add:
<FlagButton
    title={`Karyawan terlambat: ${emp.name}`}
    sourceType="ATTENDANCE"
    sourceId={emp.id || `emp-${i}`}
    sourceLabel={emp.name}
/>
```

**Arus Kas** — top expenses:
```tsx
// In topExpenses map, add:
<FlagButton
    title={`Review pengeluaran: ${exp.name}`}
    sourceType="EXPENSE"
    sourceId={`exp-${i}`}
    sourceLabel={exp.name}
/>
```

**Profitabilitas** — low-margin products:
```tsx
// In topProducts map, add (only if margin < 20%):
{p.marginPct < 20 && (
    <FlagButton
        title={`Margin rendah: ${p.name} (${p.marginPct}%)`}
        sourceType="PRODUCT"
        sourceId={`prod-${i}`}
        sourceLabel={p.name}
    />
)}
```

**Pelanggan** — top customers:
```tsx
// In top3Customers map, add:
<FlagButton
    title={`Follow up pelanggan: ${c.name}`}
    sourceType="CUSTOMER"
    sourceId={c.id || `cust-${i}`}
    sourceLabel={c.name}
/>
```

**Kepatuhan** — all metrics rows have alert state, add a single flag for entire compliance card:
```tsx
// After the traffic light status section, add if status is not green:
{compliance.status !== 'green' && (
    <div className="mt-1.5">
        <FlagButton
            title={`Kepatuhan butuh perhatian: ${compliance.totalIssues} masalah`}
            sourceType="JOURNAL"
            sourceId="compliance"
            sourceLabel={`${compliance.totalIssues} item compliance`}
        />
    </div>
)}
```

**IMPORTANT:** Every row container that gets a FlagButton must have `className="... group"` added so the flag icon appears on hover.

**Step 3: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: add FlagButton to all actionable dashboard card items"
```

---

## Task 6: Upgrade NotificationCenter to Show CEO Flags

**Files:**
- Modify: `components/notification-center.tsx`

**Step 1: Upgrade NotificationCenter**

The current component shows smart counts from `useSidebarActions()`. Add a second section below it showing CEO flags (PENDING status). Add tabs: "Tugas" (existing counts) and "Flag CEO" (new flags from `useCeoFlags`).

Key changes:
1. Import `useCeoFlags`, `useMarkFlagRead`, `useMarkFlagActed`, `usePendingFlagCount`
2. Add two tabs at the top of the popover: "Tugas" and "Flag CEO"
3. "Tugas" tab = existing smart count notifications (unchanged)
4. "Flag CEO" tab = list of PENDING/READ flags from `useCeoFlags({ status: "PENDING" })`
   - Each flag shows: title, CEO note (if any), timestamp, sourceLabel
   - Two action buttons: "Tandai Dibaca" (marks READ) and "Selesai" (marks ACTED)
   - ACTED flags disappear from list
5. Badge count in bell = existing count + pending flag count

**Flag item in the list looks like:**
```
┌─────────────────────────────────┐
│ 🚩 Invoice overdue: PT ABC     │
│    "Hubungi hari ini"    2m ago │
│    INV-2026-001                 │
│    [Tandai Dibaca] [✓ Selesai]  │
└─────────────────────────────────┘
```

**Step 2: Commit**

```bash
git add components/notification-center.tsx
git commit -m "feat: upgrade NotificationCenter with CEO flag tab and actions"
```

---

## Task 7: Verify & Type Check

**Step 1:** Run `npx tsc --noEmit` — check no new errors in our files
**Step 2:** Run `npm run dev` — open `/dashboard`
**Step 3:** Verify:
- Flag icons appear on hover for each actionable row
- Clicking flag opens popover with title, optional note textarea, "Kirim Flag" button
- After sending, flag turns orange (filled)
- Toast shows "Flag terkirim ke tim terkait"
- Notification bell shows the new flag in "Flag CEO" tab
- "Tandai Dibaca" and "Selesai" buttons work
**Step 4:** Run `npx vitest` — ensure no regressions

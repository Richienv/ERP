# AP/AR Consolidation + Debit/Credit Notes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Merge the two separate AP sidebar items into a single "Hutang Usaha (AP)" page with tabs (Tagihan, Pembayaran, Nota Debit), and add a "Nota Kredit" tab to a new "Piutang Usaha (AR)" page.

**Architecture:** Create two new wrapper pages (`/finance/payables` and `/finance/receivables`) that use shadcn Tabs to compose existing page components as tab content. The existing standalone pages stay functional (no breaking changes). Nota Debit creation gets a new dialog component with GL posting.

**Tech Stack:** Next.js App Router, shadcn/ui Tabs, TanStack Query, existing server actions from `lib/actions/finance.ts`

---

### Task 1: Create Hutang Usaha (AP) page with Tagihan + Pembayaran tabs

**Files:**
- Create: `app/finance/payables/page.tsx`

This page wraps the existing bills and vendor-payments content into tabs. It imports the existing hooks directly rather than embedding the old pages.

**Step 1: Create the payables page**

```tsx
// app/finance/payables/page.tsx
"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"

// Lazy-load tab content to avoid loading all 3 tabs at once
const BillsTab = dynamic(() => import("../../finance/bills/page"), { ssr: false })
const VendorPaymentsTab = dynamic(() => import("../../finance/vendor-payments/page"), { ssr: false })

export default function PayablesPage() {
    const searchParams = useSearchParams()
    const initialTab = searchParams.get("tab") || "tagihan"
    const [activeTab, setActiveTab] = useState(initialTab)

    return (
        <div className="mf-page">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Hutang Usaha (AP)</h1>
                    <p className="text-xs text-zinc-500 font-medium mt-1">Kelola tagihan vendor, pembayaran, dan nota debit</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="border-2 border-black bg-white h-10 p-1 gap-1">
                    <TabsTrigger value="tagihan" className="font-bold text-xs uppercase tracking-wider data-[state=active]:bg-black data-[state=active]:text-white">
                        Tagihan
                    </TabsTrigger>
                    <TabsTrigger value="pembayaran" className="font-bold text-xs uppercase tracking-wider data-[state=active]:bg-black data-[state=active]:text-white">
                        Pembayaran
                    </TabsTrigger>
                    <TabsTrigger value="nota-debit" className="font-bold text-xs uppercase tracking-wider data-[state=active]:bg-black data-[state=active]:text-white">
                        Nota Debit
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="tagihan" className="mt-4">
                    <BillsTab />
                </TabsContent>
                <TabsContent value="pembayaran" className="mt-4">
                    <VendorPaymentsTab />
                </TabsContent>
                <TabsContent value="nota-debit" className="mt-4">
                    <div className="text-sm text-zinc-400 p-8 text-center">Nota Debit tab — implemented in Task 3</div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
```

**Note:** The BillsTab and VendorPaymentsTab are the existing page components loaded via `dynamic()`. They already have their own `mf-page` wrapper — you may need to strip the outer wrapper from those pages by extracting their content into separate client components (e.g., `BillsContent` and `VendorPaymentsContent`). If the existing pages have `<div className="mf-page">` at root, create thin wrapper components that render the content without the outer div. Otherwise, just import directly.

**Step 2: Verify the page renders**

Run: `npm run dev` and navigate to `http://localhost:3002/finance/payables`

Expected: Page shows with 3 tabs. "Tagihan" tab shows the bills list. "Pembayaran" tab shows vendor payments. "Nota Debit" tab shows placeholder.

---

### Task 2: Create Piutang Usaha (AR) page with Penerimaan + Nota Kredit tabs

**Files:**
- Create: `app/finance/receivables/page.tsx`

Same pattern as Task 1, but for AR side.

**Step 1: Create the receivables page**

```tsx
// app/finance/receivables/page.tsx
"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"

const PaymentsTab = dynamic(() => import("../../finance/payments/page"), { ssr: false })

export default function ReceivablesPage() {
    const searchParams = useSearchParams()
    const initialTab = searchParams.get("tab") || "penerimaan"
    const [activeTab, setActiveTab] = useState(initialTab)

    return (
        <div className="mf-page">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Piutang Usaha (AR)</h1>
                    <p className="text-xs text-zinc-500 font-medium mt-1">Kelola penerimaan pembayaran dan nota kredit pelanggan</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="border-2 border-black bg-white h-10 p-1 gap-1">
                    <TabsTrigger value="penerimaan" className="font-bold text-xs uppercase tracking-wider data-[state=active]:bg-black data-[state=active]:text-white">
                        Penerimaan
                    </TabsTrigger>
                    <TabsTrigger value="nota-kredit" className="font-bold text-xs uppercase tracking-wider data-[state=active]:bg-black data-[state=active]:text-white">
                        Nota Kredit
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="penerimaan" className="mt-4">
                    <PaymentsTab />
                </TabsContent>
                <TabsContent value="nota-kredit" className="mt-4">
                    <div className="text-sm text-zinc-400 p-8 text-center">Nota Kredit — implemented in Task 4</div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
```

**Step 2: Verify**

Navigate to `http://localhost:3002/finance/receivables`. The "Penerimaan" tab should show existing AR payments view.

---

### Task 3: Build Nota Debit tab with create dialog

**Files:**
- Create: `components/finance/nota-debit-tab.tsx`
- Modify: `app/finance/payables/page.tsx` (replace placeholder)
- Read: `lib/actions/finance.ts` (use existing `createDebitNote()`)
- Read: `hooks/use-credit-debit-notes.ts` (use existing hook)

**Step 1: Create the Nota Debit tab component**

The component needs:
1. KPI strip (Total DN bulan ini, Pending, Approved)
2. "+ Buat Nota Debit" button
3. Table listing existing debit notes
4. Create dialog with: Supplier, Bill Asal, Alasan, Jumlah, PPN, Catatan, GL Preview

```tsx
// components/finance/nota-debit-tab.tsx
"use client"

import { useState } from "react"
import { Plus, FileText, Building2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { useCreditDebitNotes } from "@/hooks/use-credit-debit-notes"
import { createDebitNote } from "@/lib/actions/finance"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

const REASON_CODES = [
    { code: "RET-DEFECT", label: "Barang Cacat/Rusak" },
    { code: "RET-WRONG", label: "Barang Tidak Sesuai" },
    { code: "RET-QUALITY", label: "Kualitas Tidak Standar" },
    { code: "ADJ-OVERCHARGE", label: "Koreksi Harga (Kelebihan Bayar)" },
    { code: "ADJ-DISCOUNT", label: "Diskon Belum Dipotong" },
    { code: "OTHER", label: "Lainnya" },
]

export function NotaDebitTab() {
    const { data, isLoading } = useCreditDebitNotes()
    const queryClient = useQueryClient()
    const [showDialog, setShowDialog] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [includePPN, setIncludePPN] = useState(true)
    const [form, setForm] = useState({
        supplierId: "",
        originalBillId: "",
        reason: "",
        amount: "",
        notes: "",
        date: new Date().toISOString().split("T")[0],
    })

    // Filter only DEBIT_NOTE from the notes list
    const debitNotes = (data?.notes ?? []).filter((n: any) => n.type === "DEBIT_NOTE")
    const suppliers = data?.suppliers ?? []
    const apAccounts = data?.apAccounts ?? []
    const expenseAccounts = data?.expenseAccounts ?? []

    const subtotal = Number(form.amount) || 0
    const ppnAmount = includePPN ? Math.round(subtotal * 0.11) : 0
    const total = subtotal + ppnAmount

    // KPI calculations
    const totalDN = debitNotes.reduce((sum: number, n: any) => sum + Number(n.total || n.amount || 0), 0)
    const pendingDN = debitNotes.filter((n: any) => n.status === "DRAFT").length
    const approvedDN = debitNotes.filter((n: any) => n.status === "APPROVED" || n.status === "APPLIED").length

    const resetForm = () => {
        setForm({ supplierId: "", originalBillId: "", reason: "", amount: "", notes: "", date: new Date().toISOString().split("T")[0] })
        setIncludePPN(true)
    }

    const handleSubmit = async (postImmediately: boolean) => {
        if (!form.supplierId || subtotal <= 0 || !form.reason) {
            toast.error("Lengkapi Supplier, Jumlah, dan Alasan")
            return
        }

        // Find default AP and expense accounts
        const defaultAP = apAccounts[0]
        const defaultExpense = expenseAccounts[0]
        if (!defaultAP || !defaultExpense) {
            toast.error("Akun AP atau Beban tidak ditemukan. Pastikan Chart of Accounts sudah diatur.")
            return
        }

        setSubmitting(true)
        try {
            const result = await createDebitNote({
                supplierId: form.supplierId,
                originalBillId: form.originalBillId || undefined,
                amount: subtotal,
                reason: `[${form.reason}] ${form.notes}`.trim(),
                date: new Date(form.date + "T12:00:00"),
                apAccountId: defaultAP.id,
                expenseAccountId: defaultExpense.id,
            })

            if (result.success) {
                toast.success(`Nota Debit ${result.number} berhasil dibuat`)
                setShowDialog(false)
                resetForm()
                queryClient.invalidateQueries({ queryKey: queryKeys.creditDebitNotes.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.bills.all })
            } else {
                toast.error(result.error || "Gagal membuat Nota Debit")
            }
        } catch (err) {
            toast.error("Terjadi kesalahan")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="space-y-4">
            {/* KPI Strip */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "Total Nota Debit", value: formatIDR(totalDN), color: "bg-amber-50 border-amber-200" },
                    { label: "Pending / Draft", value: String(pendingDN), color: "bg-zinc-50 border-zinc-200" },
                    { label: "Approved", value: String(approvedDN), color: "bg-emerald-50 border-emerald-200" },
                ].map((kpi) => (
                    <div key={kpi.label} className={`border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] p-3 ${kpi.color}`}>
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{kpi.label}</p>
                        <p className="text-lg font-black mt-1">{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{debitNotes.length} Nota Debit</span>
                <Button onClick={() => setShowDialog(true)} className="bg-black text-white font-bold text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all">
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Buat Nota Debit
                </Button>
            </div>

            {/* Table */}
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-zinc-50">
                            <TableHead className="text-[10px] font-black uppercase tracking-widest">No</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest">Supplier</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest">Alasan</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Jumlah</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest">Status</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest">Tanggal</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {debitNotes.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-zinc-400 text-xs font-bold uppercase">
                                    Belum ada nota debit
                                </TableCell>
                            </TableRow>
                        ) : (
                            debitNotes.map((note: any) => (
                                <TableRow key={note.id}>
                                    <TableCell className="font-mono font-bold text-sm">{note.number}</TableCell>
                                    <TableCell className="text-sm">{note.partyName || "-"}</TableCell>
                                    <TableCell className="text-sm text-zinc-500 max-w-[200px] truncate">{note.reason}</TableCell>
                                    <TableCell className="text-right font-mono font-bold">{formatIDR(Number(note.total || note.amount || 0))}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`text-[9px] font-black uppercase ${
                                            note.status === "DRAFT" ? "border-zinc-300 text-zinc-500" :
                                            note.status === "APPROVED" ? "border-emerald-300 text-emerald-600 bg-emerald-50" :
                                            note.status === "APPLIED" ? "border-blue-300 text-blue-600 bg-blue-50" :
                                            "border-zinc-300 text-zinc-500"
                                        }`}>{note.status}</Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-zinc-500">{new Date(note.issueDate).toLocaleDateString("id-ID")}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Create Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="font-black text-lg uppercase tracking-wider">Buat Nota Debit</DialogTitle>
                        <DialogDescription>Buat nota debit untuk koreksi tagihan supplier atau retur barang</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 mt-2">
                        {/* Supplier */}
                        <div>
                            <Label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Supplier *</Label>
                            <Select value={form.supplierId} onValueChange={(v) => setForm(f => ({ ...f, supplierId: v }))}>
                                <SelectTrigger className="border-2 border-black h-10 font-medium">
                                    <SelectValue placeholder="Pilih supplier..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {suppliers.map((s: any) => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Reason */}
                        <div>
                            <Label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Alasan *</Label>
                            <Select value={form.reason} onValueChange={(v) => setForm(f => ({ ...f, reason: v }))}>
                                <SelectTrigger className="border-2 border-black h-10 font-medium">
                                    <SelectValue placeholder="Pilih alasan..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {REASON_CODES.map((r) => (
                                        <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Amount */}
                        <div>
                            <Label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Jumlah (sebelum PPN) *</Label>
                            <Input
                                type="number"
                                value={form.amount}
                                onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                                placeholder="0"
                                className="border-2 border-black h-10 font-mono font-bold"
                            />
                        </div>

                        {/* PPN */}
                        <div className="flex items-center gap-2">
                            <Checkbox
                                checked={includePPN}
                                onCheckedChange={(c) => setIncludePPN(!!c)}
                                className="border-2 border-black"
                            />
                            <span className="text-sm font-medium">Termasuk PPN 11%</span>
                            {includePPN && ppnAmount > 0 && (
                                <span className="text-xs text-zinc-500 ml-auto font-mono">PPN: {formatIDR(ppnAmount)}</span>
                            )}
                        </div>

                        {/* Total preview */}
                        {subtotal > 0 && (
                            <div className="bg-zinc-50 border-2 border-black p-3">
                                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">Preview Jurnal</p>
                                <div className="space-y-1 text-xs font-mono">
                                    <div className="flex justify-between"><span>DR 2100 Hutang Usaha</span><span className="font-bold">{formatIDR(total)}</span></div>
                                    <div className="flex justify-between text-zinc-500"><span>CR 5000 HPP</span><span>{formatIDR(subtotal)}</span></div>
                                    {ppnAmount > 0 && (
                                        <div className="flex justify-between text-zinc-500"><span>CR 1330 PPN Masukan</span><span>{formatIDR(ppnAmount)}</span></div>
                                    )}
                                    <div className="border-t border-black pt-1 flex justify-between font-bold"><span>Total</span><span>{formatIDR(total)}</span></div>
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        <div>
                            <Label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Catatan</Label>
                            <Textarea
                                value={form.notes}
                                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                                placeholder="Keterangan tambahan..."
                                className="border-2 border-black text-sm"
                                rows={2}
                            />
                        </div>

                        {/* Date */}
                        <div>
                            <Label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Tanggal</Label>
                            <Input
                                type="date"
                                value={form.date}
                                onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                                className="border-2 border-black h-10 font-medium"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 mt-4 justify-end">
                        <Button variant="outline" onClick={() => setShowDialog(false)} className="border-2 border-black font-bold text-xs">
                            Batal
                        </Button>
                        <Button
                            onClick={() => handleSubmit(false)}
                            disabled={submitting}
                            className="bg-black text-white font-bold text-xs border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
                        >
                            {submitting ? "Menyimpan..." : "Simpan & Posting"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
```

**Step 2: Wire the component into payables page**

In `app/finance/payables/page.tsx`, replace the "Nota Debit" TabsContent placeholder:

```tsx
import { NotaDebitTab } from "@/components/finance/nota-debit-tab"

// ... in the TabsContent for nota-debit:
<TabsContent value="nota-debit" className="mt-4">
    <NotaDebitTab />
</TabsContent>
```

**Step 3: Verify**

Navigate to `/finance/payables?tab=nota-debit`. Should show KPI strip, empty table, and "+ Buat Nota Debit" button. Click it to open the dialog, fill in fields, and verify GL preview updates as you type.

---

### Task 4: Build Nota Kredit tab for AR page

**Files:**
- Create: `components/finance/nota-kredit-tab.tsx`
- Modify: `app/finance/receivables/page.tsx` (replace placeholder)
- Read: `lib/actions/finance.ts` (use existing `createCreditNote()`)

This is similar to Task 3 but for the customer/AR side. Extract the credit note portion from the existing `/finance/credit-notes/page.tsx`.

**Step 1: Create the Nota Kredit tab component**

Same pattern as NotaDebitTab but:
- Filter `notes` by `type === "CREDIT_NOTE"`
- Use `customers` instead of `suppliers`
- Use `createCreditNote()` instead of `createDebitNote()`
- GL Preview: DR 4000 Pendapatan + DR 2110 PPN Keluaran, CR 1100 Piutang
- Reason codes: Retur Barang, Koreksi Harga, Diskon, Pembatalan Jasa, Lainnya

**Step 2: Wire into receivables page**

```tsx
import { NotaKreditTab } from "@/components/finance/nota-kredit-tab"

<TabsContent value="nota-kredit" className="mt-4">
    <NotaKreditTab />
</TabsContent>
```

**Step 3: Verify**

Navigate to `/finance/receivables?tab=nota-kredit`. Should show credit notes list and creation dialog.

---

### Task 5: Update sidebar navigation

**Files:**
- Modify: `components/app-sidebar.tsx` (lines ~168-185)

**Step 1: Replace the 3 sidebar items with 2**

Find the finance section items and change:

```tsx
// BEFORE:
{
  title: "Penerimaan (AR)",
  url: "/finance/payments",
},
{
  title: "Tagihan Vendor (AP)",
  url: "/finance/bills",
},
{
  title: "Pembayaran (AP)",
  url: "/finance/vendor-payments",
},

// AFTER:
{
  title: "Piutang Usaha (AR)",
  url: "/finance/receivables",
},
{
  title: "Hutang Usaha (AP)",
  url: "/finance/payables",
},
```

**Step 2: Remove the standalone credit-notes item if it exists in sidebar**

Search for "credit-notes" in the sidebar items and remove it.

**Step 3: Verify**

Check sidebar shows "Piutang Usaha (AR)" and "Hutang Usaha (AP)". Click each and verify tabs work. Verify old routes `/finance/bills`, `/finance/payments`, `/finance/vendor-payments` still work independently (they're not deleted, just not in sidebar).

---

### Task 6: Add query keys and prefetch for new routes

**Files:**
- Modify: `lib/query-keys.ts` (add payables/receivables keys if needed)
- Modify: `hooks/use-nav-prefetch.ts` (add hover prefetch for new routes)

**Step 1: Add prefetch entries for the new routes**

In `hooks/use-nav-prefetch.ts`, add entries for `/finance/payables` and `/finance/receivables` that prefetch the same data as their respective sub-pages.

**Step 2: Verify hover prefetch**

Hover over "Hutang Usaha (AP)" in sidebar — network tab should show data being prefetched.

---

### Task 7: Fix GL account codes in existing createDebitNote / createCreditNote

**Files:**
- Modify: `lib/actions/finance.ts` (find `createDebitNote` and `createCreditNote`)

Ensure the GL posting in these functions uses the standard account codes:
- **Credit Note:** DR 4000 Pendapatan, DR 2110 PPN Keluaran, CR 1100 Piutang Usaha
- **Debit Note:** DR 2100 Hutang Usaha, CR 5000 HPP, CR 1330 PPN Masukan

Check the existing implementation and fix any wrong account codes (they may use old codes like 1200, 2000, 4101, etc.).

Also ensure GL entries include proper Bahasa Indonesia descriptions.

---

## Execution Priority

1. **Task 1** — Create AP wrapper page (the biggest visual change)
2. **Task 2** — Create AR wrapper page
3. **Task 3** — Build Nota Debit tab (the main new feature)
4. **Task 4** — Build Nota Kredit tab (refactor from existing)
5. **Task 5** — Update sidebar (makes it all visible)
6. **Task 6** — Prefetch optimization
7. **Task 7** — GL account code fixes

## Verification

After all tasks:
- Sidebar shows 2 items instead of 3 for AP/AR
- `/finance/payables` has 3 working tabs
- `/finance/receivables` has 2 working tabs
- Creating a Nota Debit posts correct GL entry (DR 2100, CR 5000/1330)
- Creating a Nota Kredit posts correct GL entry (DR 4000/2110, CR 1100)
- Old routes still work (not deleted)

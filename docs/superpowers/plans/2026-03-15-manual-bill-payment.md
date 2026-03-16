# Manual Bill Payment — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a MANUAL payment tab to the AP bill payment dialog so users can record offline vendor payments (transfer, cash, check, giro) with multi-bill allocation.

**Architecture:** Single-file change to `app/finance/bills/page.tsx`. The existing Xendit pay dialog gets wrapped in top-level tabs (`MANUAL` | `XENDIT`). The MANUAL tab reuses `recordMultiBillPayment()` server action and `useBankAccounts()` hook — no new backend code.

**Tech Stack:** React, shadcn/ui Tabs/Dialog/Select/Checkbox/Input, TanStack Query, existing server actions.

**Spec:** `docs/superpowers/specs/2026-03-15-manual-bill-payment-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `app/finance/bills/page.tsx` | Add imports, state, manual payment handler, MANUAL tab UI inside pay dialog |

Only one file changes. No new files.

---

## Chunk 1: Implementation

### Task 1: Add new imports

**Files:**
- Modify: `app/finance/bills/page.tsx:1-51`

- [ ] **Step 1: Add missing imports**

Add these imports to the existing import block at the top of the file:

```tsx
// Add to lucide-react imports (line 5-23):
import {
    Plus,
    XCircle,
    Receipt,
    Building2,
    CreditCard,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Wallet,
    Search,
    FileText,
    Eye,
    X,
    ChevronLeft,
    ChevronRight,
    Filter,
    RotateCcw,
    Banknote,       // NEW
    Check,          // NEW
    Minus,          // NEW
} from "lucide-react"

// Add new imports after existing imports:
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useBankAccounts } from "@/hooks/use-bank-accounts"
import { recordMultiBillPayment } from "@/lib/actions/finance"
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit app/finance/bills/page.tsx 2>&1 | head -20`
Expected: No new errors (existing ones may appear — that's fine per project config)

---

### Task 2: Add manual payment state variables

**Files:**
- Modify: `app/finance/bills/page.tsx:88-103` (after existing state declarations)

- [ ] **Step 1: Add state variables and bank accounts hook**

Add after line 103 (after `paymentForm` state), inside the component:

```tsx
// Manual payment state
const [paymentTab, setPaymentTab] = useState<"manual" | "xendit">("manual")
const [manualMethod, setManualMethod] = useState<"TRANSFER" | "CHECK" | "GIRO" | "CASH">("TRANSFER")
const [manualBankAccount, setManualBankAccount] = useState("1010")
const [manualReference, setManualReference] = useState("")
const [manualNotes, setManualNotes] = useState("")
const [manualAllocations, setManualAllocations] = useState<Array<{
    billId: string
    billNumber: string
    totalAmount: number
    balanceDue: number
    selected: boolean
    allocatedAmount: number
    dueDate: Date
    isOverdue: boolean
}>>([])

const { data: bankAccounts } = useBankAccounts()
```

- [ ] **Step 2: Add allocation initialization when dialog opens**

Add a `useEffect` after the existing one (after line 114):

```tsx
// Initialize manual allocations when pay dialog opens
useEffect(() => {
    if (isPayOpen && activeBill && activeBill.vendor) {
        const vendorId = activeBill.vendor.id
        const vendorBills = bills
            .filter((b) => b.vendor?.id === vendorId && b.balanceDue > 0 && b.status !== "PAID")
            .map((b) => ({
                billId: b.id,
                billNumber: b.number,
                totalAmount: b.amount,
                balanceDue: b.balanceDue,
                dueDate: new Date(b.dueDate),
                isOverdue: b.isOverdue,
                selected: b.id === activeBill.id,
                allocatedAmount: b.id === activeBill.id ? b.balanceDue : 0,
            }))
        setManualAllocations(vendorBills)
        setPaymentTab("manual")
        setManualMethod("TRANSFER")
        setManualBankAccount("1010")
        setManualReference("")
        setManualNotes("")
    }
}, [isPayOpen, activeBill, bills])
```

---

### Task 3: Add manual payment submit handler and allocation helpers

**Files:**
- Modify: `app/finance/bills/page.tsx` (after `handlePaySubmit`, around line 186)

- [ ] **Step 1: Add allocation helper functions**

Add after the existing `handlePaySubmit` function:

```tsx
// Manual payment allocation helpers
const manualTotalAllocated = manualAllocations
    .filter((a) => a.selected)
    .reduce((sum, a) => sum + a.allocatedAmount, 0)

const manualSelectedCount = manualAllocations.filter((a) => a.selected).length

const toggleManualBill = (billId: string) => {
    setManualAllocations((prev) =>
        prev.map((a) =>
            a.billId === billId
                ? { ...a, selected: !a.selected, allocatedAmount: !a.selected ? a.balanceDue : 0 }
                : a
        )
    )
}

const updateManualAllocation = (billId: string, amount: number) => {
    setManualAllocations((prev) =>
        prev.map((a) =>
            a.billId === billId
                ? { ...a, allocatedAmount: Math.min(Math.max(0, amount), a.balanceDue) }
                : a
        )
    )
}

const selectAllManual = () => {
    setManualAllocations((prev) =>
        prev.map((a) => ({ ...a, selected: true, allocatedAmount: a.balanceDue }))
    )
}

const deselectAllManual = () => {
    setManualAllocations((prev) =>
        prev.map((a) => ({ ...a, selected: false, allocatedAmount: 0 }))
    )
}
```

- [ ] **Step 2: Add manual payment submit handler**

Add after the helper functions:

```tsx
const handleManualPaySubmit = async () => {
    if (!activeBill?.vendor?.id) {
        toast.error("Vendor tidak ditemukan")
        return
    }
    const selected = manualAllocations.filter((a) => a.selected && a.allocatedAmount > 0)
    if (selected.length === 0) {
        toast.error("Pilih minimal satu tagihan untuk dibayar")
        return
    }
    if ((manualMethod === "CHECK" || manualMethod === "GIRO") && !manualReference.trim()) {
        toast.error(manualMethod === "GIRO" ? "Nomor giro wajib diisi" : "Nomor cek wajib diisi")
        return
    }

    setProcessing(true)
    try {
        const result = await recordMultiBillPayment({
            supplierId: activeBill.vendor.id,
            allocations: selected.map((a) => ({
                billId: a.billId,
                amount: a.allocatedAmount,
            })),
            method: manualMethod,
            reference: manualReference.trim() || undefined,
            notes: manualNotes.trim() || undefined,
            bankAccountCode: manualBankAccount,
        })

        if (result.success) {
            const payNum = "paymentNumber" in result ? result.paymentNumber : ""
            toast.success(`Pembayaran ${payNum} berhasil — ${selected.length} tagihan, total ${formatIDR(manualTotalAllocated)}`)
            setIsPayOpen(false)
            invalidateAfterPayout()
        } else {
            const errMsg = "error" in result ? result.error : "Gagal mencatat pembayaran"
            toast.error(errMsg || "Gagal mencatat pembayaran")
        }
    } catch {
        toast.error("Terjadi kesalahan saat memproses pembayaran")
    } finally {
        setProcessing(false)
    }
}
```

---

### Task 4: Replace the pay dialog with tabbed version

**Files:**
- Modify: `app/finance/bills/page.tsx:522-569` (the PAY DIALOG section)

- [ ] **Step 1: Replace the entire pay dialog**

Replace lines 522-569 (the `{/* ═══ PAY DIALOG ═══ */}` section) with:

```tsx
{/* ═══ PAY DIALOG ═══ */}
<Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
    <DialogContent className={NB.contentWide}>
        <DialogHeader className={NB.header}>
            <DialogTitle className={NB.title}><CreditCard className="h-5 w-5" /> Pembayaran Tagihan</DialogTitle>
            <p className={NB.subtitle}>Pilih metode dan konfirmasi pembayaran vendor.</p>
        </DialogHeader>
        <div className={`overflow-y-auto ${NB.scroll}`}>
            {/* Amount display */}
            <div className={NB.section}>
                <div className={NB.sectionHead}><Receipt className="h-3.5 w-3.5" /><span className={NB.sectionTitle}>Jumlah Bayar</span></div>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-center">
                    <p className="text-3xl font-black text-emerald-700 dark:text-emerald-400">{activeBill ? formatIDR(activeBill.balanceDue) : "-"}</p>
                    <p className="text-[10px] font-bold text-emerald-600/70 mt-1">{activeBill?.number} — {activeBill?.vendor?.name || "Unknown"}</p>
                </div>
            </div>

            {/* Top-level tabs: MANUAL | XENDIT */}
            <div className="px-6 pt-4">
                <Tabs value={paymentTab} onValueChange={(v) => setPaymentTab(v as "manual" | "xendit")} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 border-2 border-black rounded-none">
                        <TabsTrigger value="manual" className="flex items-center gap-2 rounded-none font-black uppercase text-xs tracking-wider">
                            <Building2 className="h-4 w-4" /> Manual
                        </TabsTrigger>
                        <TabsTrigger value="xendit" className="flex items-center gap-2 rounded-none font-black uppercase text-xs tracking-wider">
                            <Wallet className="h-4 w-4" /> Xendit
                        </TabsTrigger>
                    </TabsList>

                    {/* ─── MANUAL TAB ─── */}
                    <TabsContent value="manual" className="space-y-4 mt-4">
                        {!activeBill?.vendor?.id ? (
                            <div className="p-8 text-center border-2 border-dashed border-zinc-300">
                                <AlertCircle className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                    Vendor tidak ditemukan untuk tagihan ini
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Method & Account */}
                                <div className={NB.section}>
                                    <div className={NB.sectionHead}>
                                        <Banknote className="h-3.5 w-3.5" />
                                        <span className={NB.sectionTitle}>Metode & Akun</span>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <Label className={NB.label}>Metode Pembayaran <span className={NB.labelRequired}>*</span></Label>
                                                <Select value={manualMethod} onValueChange={(v) => {
                                                    const m = v as "TRANSFER" | "CHECK" | "GIRO" | "CASH"
                                                    setManualMethod(m)
                                                    setManualBankAccount(m === "CASH" ? "1000" : "1010")
                                                }}>
                                                    <SelectTrigger className={NB.select}><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="TRANSFER">Transfer Manual</SelectItem>
                                                        <SelectItem value="CASH">Tunai</SelectItem>
                                                        <SelectItem value="CHECK">Cek</SelectItem>
                                                        <SelectItem value="GIRO">Giro</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className={NB.label}>Akun Pembayaran <span className={NB.labelRequired}>*</span></Label>
                                                <Select value={manualBankAccount} onValueChange={setManualBankAccount}>
                                                    <SelectTrigger className={NB.select}><SelectValue placeholder="Pilih akun..." /></SelectTrigger>
                                                    <SelectContent>
                                                        {bankAccounts?.map((a) => (
                                                            <SelectItem key={a.code} value={a.code}>
                                                                {a.code} — {a.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <Label className={NB.label}>
                                                    Referensi{(manualMethod === "CHECK" || manualMethod === "GIRO") && <span className={NB.labelRequired}> *</span>}
                                                </Label>
                                                <Input
                                                    value={manualReference}
                                                    onChange={(e) => setManualReference(e.target.value)}
                                                    placeholder={manualMethod === "CHECK" ? "No. Cek" : manualMethod === "GIRO" ? "No. Giro" : "Ref transfer..."}
                                                    className={NB.input}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className={NB.label}>Catatan</Label>
                                                <Input
                                                    value={manualNotes}
                                                    onChange={(e) => setManualNotes(e.target.value)}
                                                    placeholder="Opsional..."
                                                    className={NB.input}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Bill allocation table */}
                                <div className={NB.section}>
                                    <div className={NB.sectionHead + " justify-between"}>
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-3.5 w-3.5" />
                                            <span className={NB.sectionTitle}>Tagihan Vendor ({manualAllocations.length})</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button type="button" variant="ghost" onClick={selectAllManual} className="text-[9px] font-black uppercase tracking-widest h-7 px-2">
                                                <Check className="h-3 w-3 mr-1" /> Semua
                                            </Button>
                                            <Button type="button" variant="ghost" onClick={deselectAllManual} className="text-[9px] font-black uppercase tracking-widest h-7 px-2">
                                                <Minus className="h-3 w-3 mr-1" /> Batal
                                            </Button>
                                        </div>
                                    </div>

                                    {manualAllocations.length === 0 ? (
                                        <div className="p-8 text-center">
                                            <FileText className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                                Tidak ada tagihan terbuka untuk vendor ini
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Table header */}
                                            <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-black text-zinc-400">
                                                <div className="col-span-1 text-[9px] font-black uppercase tracking-widest"></div>
                                                <div className="col-span-3 text-[9px] font-black uppercase tracking-widest">No. Tagihan</div>
                                                <div className="col-span-2 text-[9px] font-black uppercase tracking-widest">Jatuh Tempo</div>
                                                <div className="col-span-2 text-[9px] font-black uppercase tracking-widest text-right">Total</div>
                                                <div className="col-span-2 text-[9px] font-black uppercase tracking-widest text-right">Sisa</div>
                                                <div className="col-span-2 text-[9px] font-black uppercase tracking-widest text-right">Bayar</div>
                                            </div>

                                            {/* Rows */}
                                            {manualAllocations.map((row) => (
                                                <div
                                                    key={row.billId}
                                                    className={`grid grid-cols-12 gap-2 items-center px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 ${
                                                        row.selected ? "bg-emerald-50 dark:bg-emerald-950/30" : ""
                                                    } ${row.isOverdue ? "border-l-4 border-l-red-400" : ""}`}
                                                >
                                                    <div className="col-span-1 flex items-center justify-center">
                                                        <Checkbox checked={row.selected} onCheckedChange={() => toggleManualBill(row.billId)} />
                                                    </div>
                                                    <div className="col-span-3">
                                                        <span className="font-mono text-xs font-bold">{row.billNumber}</span>
                                                        {row.isOverdue && (
                                                            <span className="ml-2 text-[9px] font-black uppercase text-red-600 bg-red-100 px-1.5 py-0.5">Overdue</span>
                                                        )}
                                                    </div>
                                                    <div className="col-span-2 text-xs text-zinc-500">
                                                        {row.dueDate.toLocaleDateString("id-ID")}
                                                    </div>
                                                    <div className="col-span-2 text-right font-mono text-xs text-zinc-500">
                                                        {formatIDR(row.totalAmount)}
                                                    </div>
                                                    <div className="col-span-2 text-right font-mono text-xs font-bold text-red-600">
                                                        {formatIDR(row.balanceDue)}
                                                    </div>
                                                    <div className="col-span-2">
                                                        {row.selected ? (
                                                            <Input
                                                                type="number"
                                                                value={row.allocatedAmount || ""}
                                                                onChange={(e) => updateManualAllocation(row.billId, Number(e.target.value))}
                                                                max={row.balanceDue}
                                                                min={0}
                                                                className="border-2 border-black font-mono font-bold h-8 text-right rounded-none text-xs w-full"
                                                            />
                                                        ) : (
                                                            <div className="text-right text-xs text-zinc-300 font-mono">-</div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>

                                {/* Payment summary */}
                                {manualSelectedCount > 0 && (
                                    <div className="border-2 border-black bg-emerald-50 dark:bg-emerald-950 p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Ringkasan Pembayaran</span>
                                                <p className="text-xs text-emerald-600 mt-0.5">{manualSelectedCount} tagihan dipilih</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 block">Total Bayar</span>
                                                <span className="font-mono font-black text-2xl text-emerald-800">{formatIDR(manualTotalAllocated)}</span>
                                            </div>
                                        </div>
                                        {/* GL Entry Preview */}
                                        <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-800">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 block mb-1">Jurnal Otomatis</span>
                                            <div className="grid grid-cols-3 gap-1 text-[10px] font-bold">
                                                <span className="text-emerald-700">Akun</span>
                                                <span className="text-emerald-700 text-right">Debit</span>
                                                <span className="text-emerald-700 text-right">Kredit</span>
                                                <span>2000 - Hutang Usaha</span>
                                                <span className="text-right font-mono">{formatIDR(manualTotalAllocated)}</span>
                                                <span className="text-right font-mono">-</span>
                                                <span>{manualBankAccount} - {bankAccounts?.find((a) => a.code === manualBankAccount)?.name || "Cash/Bank"}</span>
                                                <span className="text-right font-mono">-</span>
                                                <span className="text-right font-mono">{formatIDR(manualTotalAllocated)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </TabsContent>

                    {/* ─── XENDIT TAB ─── */}
                    <TabsContent value="xendit" className="space-y-4 mt-4">
                        <Tabs defaultValue="bank" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 border-2 border-black rounded-none">
                                <TabsTrigger value="bank" className="flex items-center gap-2 rounded-none font-black uppercase text-xs tracking-wider"><Building2 className="h-4 w-4" /> Bank Transfer</TabsTrigger>
                                <TabsTrigger value="ewallet" className="flex items-center gap-2 rounded-none font-black uppercase text-xs tracking-wider"><Wallet className="h-4 w-4" /> E-Wallet</TabsTrigger>
                            </TabsList>
                            <TabsContent value="bank" className="space-y-4 mt-4">
                                <div className="space-y-1"><label className={NB.label}>Bank <span className={NB.labelRequired}>*</span></label><Select value={paymentForm.bankCode} onValueChange={(v) => setPaymentForm({ ...paymentForm, bankCode: v })}><SelectTrigger className={NB.select}><SelectValue placeholder="Pilih bank..." /></SelectTrigger><SelectContent>{banks.map((bank) => <SelectItem key={bank.key} value={bank.key}>{bank.name}</SelectItem>)}</SelectContent></Select></div>
                                <div className="space-y-1"><label className={NB.label}>No. Rekening <span className={NB.labelRequired}>*</span></label><Input placeholder="1234567890" value={paymentForm.accountNumber} onChange={(e) => setPaymentForm({ ...paymentForm, accountNumber: e.target.value })} className={NB.inputMono} /></div>
                                <div className="space-y-1"><label className={NB.label}>Nama Pemilik Rekening <span className={NB.labelRequired}>*</span></label><Input placeholder="Nama sesuai rekening" value={paymentForm.accountHolderName} onChange={(e) => setPaymentForm({ ...paymentForm, accountHolderName: e.target.value })} className={NB.input} /><p className="text-[10px] font-bold text-zinc-400 mt-1">Harus sesuai data bank</p></div>
                            </TabsContent>
                            <TabsContent value="ewallet" className="space-y-4 mt-4">
                                <div className="space-y-1"><label className={NB.label}>E-Wallet <span className={NB.labelRequired}>*</span></label><Select value={paymentForm.bankCode} onValueChange={(v) => setPaymentForm({ ...paymentForm, bankCode: v })}><SelectTrigger className={NB.select}><SelectValue placeholder="Pilih e-wallet..." /></SelectTrigger><SelectContent>{ewallets.map((ew) => <SelectItem key={ew.key} value={ew.key}>{ew.name}</SelectItem>)}</SelectContent></Select></div>
                                <div className="space-y-1"><label className={NB.label}>No. Telepon <span className={NB.labelRequired}>*</span></label><Input placeholder="08123456789" value={paymentForm.accountNumber} onChange={(e) => setPaymentForm({ ...paymentForm, accountNumber: e.target.value })} className={NB.inputMono} /></div>
                                <div className="space-y-1"><label className={NB.label}>Nama Akun <span className={NB.labelRequired}>*</span></label><Input placeholder="Nama pemilik akun" value={paymentForm.accountHolderName} onChange={(e) => setPaymentForm({ ...paymentForm, accountHolderName: e.target.value })} className={NB.input} /></div>
                            </TabsContent>
                        </Tabs>
                        {/* Xendit fee summary */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}><CheckCircle2 className="h-3.5 w-3.5" /><span className={NB.sectionTitle}>Ringkasan</span></div>
                            <div className="p-4 space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-zinc-400 font-bold text-xs">Biaya Transfer (estimasi)</span><span className="font-bold font-mono text-xs">Rp 2.775</span></div>
                                <div className="flex justify-between border-t-2 border-black pt-2"><span className="font-black text-xs uppercase tracking-wider">Total Charge</span><span className="font-black font-mono">{activeBill ? formatIDR(activeBill.balanceDue + 2775) : "-"}</span></div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
        {/* Footer — button changes based on active tab */}
        <div className="px-6 py-4 border-t-2 border-black">
            <div className={NB.footer}>
                <Button variant="outline" onClick={() => setIsPayOpen(false)} disabled={processing} className={NB.cancelBtn}>Batal</Button>
                {paymentTab === "manual" ? (
                    <Button
                        onClick={handleManualPaySubmit}
                        disabled={processing || manualSelectedCount === 0 || manualTotalAllocated <= 0 || !activeBill?.vendor?.id}
                        className={NB.submitBtn + " bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40"}
                    >
                        {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Banknote className="h-4 w-4 mr-2" />
                        Bayar {manualSelectedCount} Tagihan — {formatIDR(manualTotalAllocated)}
                    </Button>
                ) : (
                    <Button onClick={handlePaySubmit} disabled={processing || !!paymentPendingBillId} className={NB.submitBtn}>
                        {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Konfirmasi Pembayaran
                    </Button>
                )}
            </div>
        </div>
    </DialogContent>
</Dialog>
```

- [ ] **Step 2: Verify the page compiles**

Run: `npx tsc --noEmit app/finance/bills/page.tsx 2>&1 | head -20`

- [ ] **Step 3: Visual test in browser**

Run: `npm run dev`
Navigate to: `/finance/bills` (Keuangan → Hutang Usaha)
Test:
1. Click "Bayar" on any bill row
2. Verify dialog opens with "Pembayaran Tagihan" title
3. Verify MANUAL tab is active by default
4. Verify XENDIT tab shows old Bank Transfer / E-Wallet form
5. On MANUAL tab: verify method dropdown, bank account dropdown, reference, notes fields
6. Verify allocation table shows the clicked bill pre-selected
7. Verify GL preview shows DR 2000 / CR selected bank account
8. Switch to XENDIT tab — verify original form works unchanged

- [ ] **Step 4: Functional test — submit manual payment**

On MANUAL tab:
1. Select method "Transfer Manual"
2. Keep default bank account
3. Enter a reference
4. Verify allocation table has the bill selected with correct amount
5. Click "Bayar 1 Tagihan — Rp xxx"
6. Verify success toast appears
7. Verify dialog closes
8. Verify bill status updates in the table

- [ ] **Step 5: Commit**

```bash
git add app/finance/bills/page.tsx
git commit -m "feat(finance): add manual payment tab to AP bill payment dialog

Add MANUAL/XENDIT tabs to the bill payment dialog. MANUAL tab allows
recording offline payments (transfer, cash, check, giro) with multi-bill
allocation using existing recordMultiBillPayment() server action.
GL preview correctly uses AP account 2000."
```

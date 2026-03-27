"use client"

import { useState, useMemo, useEffect } from "react"
import {
    Banknote,
    Check,
    CircleDollarSign,
    Building2,
    FileText,
    Minus,
    Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { NB } from "@/lib/dialog-styles"
import { formatIDR } from "@/lib/utils"
import { getDefaultRate, calculateWithholding } from "@/lib/pph-helpers"
import type { PPhTypeValue } from "@/lib/pph-helpers"
import { recordMultiBillPayment } from "@/lib/actions/finance"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { useBankAccounts } from "@/hooks/use-bank-accounts"
import type { VendorBill } from "@/lib/actions/finance-ap"

type PaymentMethod = "TRANSFER" | "CHECK" | "GIRO" | "CASH"

interface Vendor {
    id: string
    name: string
}

interface BillAllocationRow {
    billId: string
    billNumber: string
    totalAmount: number
    balanceDue: number
    dueDate: Date
    isOverdue: boolean
    selected: boolean
    allocatedAmount: number
}

interface VendorMultiPaymentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    vendors: Vendor[]
    openBills: VendorBill[]
    vendorAPBalances?: Array<{
        vendorId: string
        vendorName: string
        totalOutstanding: number
        billCount: number
    }>
}

export function VendorMultiPaymentDialog({
    open,
    onOpenChange,
    vendors,
    openBills,
    vendorAPBalances = [],
}: VendorMultiPaymentDialogProps) {
    const queryClient = useQueryClient()
    const { data: bankAccounts } = useBankAccounts()
    const [selectedVendorId, setSelectedVendorId] = useState("")
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("TRANSFER")
    const [bankAccountCode, setBankAccountCode] = useState("1010")
    const [reference, setReference] = useState("")
    const [notes, setNotes] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [allocations, setAllocations] = useState<BillAllocationRow[]>([])
    const [enablePPh, setEnablePPh] = useState(false)
    const [pphType, setPPhType] = useState<PPhTypeValue>("PPH_23")
    const [pphRate, setPPhRate] = useState(2)
    const [buktiPotongNo, setBuktiPotongNo] = useState("")

    // When vendor changes, rebuild allocation rows
    const handleVendorChange = (vendorId: string) => {
        setSelectedVendorId(vendorId)
        const vendorBills = openBills
            .filter((b) => b.vendor?.id === vendorId && b.balanceDue > 0)
            .map((b) => ({
                billId: b.id,
                billNumber: b.number,
                totalAmount: b.amount,
                balanceDue: b.balanceDue,
                dueDate: new Date(b.dueDate),
                isOverdue: b.isOverdue,
                selected: false,
                allocatedAmount: 0,
            }))
        setAllocations(vendorBills)
    }

    // Vendor AP balance
    const vendorBalance = useMemo(() => {
        return vendorAPBalances.find((v) => v.vendorId === selectedVendorId)
    }, [vendorAPBalances, selectedVendorId])

    // Total allocated
    const totalAllocated = useMemo(() => {
        return allocations
            .filter((a) => a.selected)
            .reduce((sum, a) => sum + a.allocatedAmount, 0)
    }, [allocations])

    const selectedCount = allocations.filter((a) => a.selected).length

    // Auto-update PPh rate when type changes
    useEffect(() => {
        setPPhRate(getDefaultRate(pphType))
    }, [pphType])

    // PPh base amount = total allocated (DPP)
    const pphBaseAmount = totalAllocated
    const pphCalc = enablePPh ? calculateWithholding(pphRate, pphBaseAmount) : null

    const toggleBill = (billId: string) => {
        setAllocations((prev) =>
            prev.map((a) =>
                a.billId === billId
                    ? {
                          ...a,
                          selected: !a.selected,
                          allocatedAmount: !a.selected ? a.balanceDue : 0,
                      }
                    : a
            )
        )
    }

    const updateAllocation = (billId: string, amount: number) => {
        setAllocations((prev) =>
            prev.map((a) =>
                a.billId === billId
                    ? {
                          ...a,
                          allocatedAmount: Math.min(Math.max(0, amount), a.balanceDue),
                      }
                    : a
            )
        )
    }

    const selectAll = () => {
        setAllocations((prev) =>
            prev.map((a) => ({ ...a, selected: true, allocatedAmount: a.balanceDue }))
        )
    }

    const deselectAll = () => {
        setAllocations((prev) =>
            prev.map((a) => ({ ...a, selected: false, allocatedAmount: 0 }))
        )
    }

    const handleSubmit = async () => {
        const selected = allocations.filter((a) => a.selected && a.allocatedAmount > 0)
        if (selected.length === 0) {
            toast.error("Pilih minimal satu tagihan untuk dibayar")
            return
        }
        if (!selectedVendorId) {
            toast.error("Pilih vendor terlebih dahulu")
            return
        }
        if ((paymentMethod === "CHECK" || paymentMethod === "GIRO") && !reference.trim()) {
            toast.error(paymentMethod === "GIRO" ? "Nomor giro wajib diisi untuk metode GIRO" : "Nomor cek wajib diisi untuk metode CHECK")
            return
        }

        setSubmitting(true)
        try {
            const result = await recordMultiBillPayment({
                supplierId: selectedVendorId,
                allocations: selected.map((a) => ({
                    billId: a.billId,
                    amount: a.allocatedAmount,
                })),
                method: paymentMethod,
                reference: reference.trim() || undefined,
                notes: notes.trim() || undefined,
                bankAccountCode,
                withholding: enablePPh ? {
                    type: pphType,
                    rate: pphRate,
                    baseAmount: pphBaseAmount,
                    buktiPotongNo: buktiPotongNo || undefined,
                } : undefined,
            })

            if (result.success) {
                const payNum = "paymentNumber" in result ? result.paymentNumber : ""
                const totalAmt = "totalAmount" in result ? result.totalAmount : totalAllocated
                toast.success(
                    `Pembayaran ${payNum} berhasil — ${selectedCount} tagihan, total ${formatIDR(totalAmt ?? totalAllocated)}`
                )
                // Reset form
                setSelectedVendorId("")
                setAllocations([])
                setReference("")
                setNotes("")
                setPaymentMethod("TRANSFER")
                setBankAccountCode("1010")
                setEnablePPh(false)
                setPPhType("PPH_23")
                setPPhRate(2)
                setBuktiPotongNo("")
                onOpenChange(false)

                // Invalidate all related queries
                queryClient.invalidateQueries({ queryKey: queryKeys.vendorPayments.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.bills.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
            } else {
                const errMsg = "error" in result ? result.error : "Gagal mencatat pembayaran"
                toast.error(errMsg || "Gagal mencatat pembayaran")
            }
        } catch {
            toast.error("Terjadi kesalahan saat memproses pembayaran")
        } finally {
            setSubmitting(false)
        }
    }

    const resetAndClose = () => {
        setSelectedVendorId("")
        setAllocations([])
        setReference("")
        setNotes("")
        setPaymentMethod("TRANSFER")
        setBankAccountCode("1010")
        setEnablePPh(false)
        setPPhType("PPH_23")
        setPPhRate(2)
        setBuktiPotongNo("")
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={resetAndClose}>
            <DialogContent className={NB.contentWide}>
                {/* Header */}
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <CircleDollarSign className="h-5 w-5" />
                        Pembayaran Multi-Tagihan
                    </DialogTitle>
                    <DialogDescription className={NB.subtitle}>
                        Bayar beberapa tagihan vendor sekaligus — bisa penuh atau sebagian
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <div className="p-6 space-y-5">
                        {/* Vendor & Method Selection */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <Building2 className="h-4 w-4" />
                                <span className={NB.sectionTitle}>Vendor & Metode</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className={NB.label}>
                                            Vendor <span className={NB.labelRequired}>*</span>
                                        </Label>
                                        <Select
                                            value={selectedVendorId}
                                            onValueChange={handleVendorChange}
                                        >
                                            <SelectTrigger className={NB.select}>
                                                <SelectValue placeholder="Pilih vendor..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {vendors.map((v) => (
                                                    <SelectItem key={v.id} value={v.id}>
                                                        {v.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className={NB.label}>
                                            Metode Pembayaran <span className={NB.labelRequired}>*</span>
                                        </Label>
                                        <Select
                                            value={paymentMethod}
                                            onValueChange={(v) => {
                                                const m = v as PaymentMethod
                                                setPaymentMethod(m)
                                                setBankAccountCode(m === "CASH" ? "1000" : "1010")
                                            }}
                                        >
                                            <SelectTrigger className={NB.select}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="TRANSFER">Transfer Bank</SelectItem>
                                                <SelectItem value="CHECK">Cek</SelectItem>
                                                <SelectItem value="GIRO">Giro</SelectItem>
                                                <SelectItem value="CASH">Tunai</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className={NB.label}>
                                            Akun Pembayaran <span className={NB.labelRequired}>*</span>
                                        </Label>
                                        <Select
                                            value={bankAccountCode}
                                            onValueChange={setBankAccountCode}
                                        >
                                            <SelectTrigger className={NB.select}>
                                                <SelectValue placeholder="Pilih akun..." />
                                            </SelectTrigger>
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
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className={NB.label}>
                                            {paymentMethod === "GIRO" ? "Referensi / No. Giro" : "Referensi / No. Cek"}
                                            {(paymentMethod === "CHECK" || paymentMethod === "GIRO") && (
                                                <span className={NB.labelRequired}> *</span>
                                            )}
                                        </Label>
                                        <Input
                                            value={reference}
                                            onChange={(e) => setReference(e.target.value)}
                                            placeholder={paymentMethod === "CHECK" ? "CHK-000123" : paymentMethod === "GIRO" ? "GR-000123" : "Ref..."}
                                            className={NB.input}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className={NB.label}>Catatan</Label>
                                        <Input
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="Opsional..."
                                            className={NB.input}
                                        />
                                    </div>
                                </div>

                                {/* Vendor AP Balance KPI */}
                                {vendorBalance && (
                                    <div className="border-2 border-black bg-amber-50 dark:bg-amber-950 p-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Banknote className="h-4 w-4 text-amber-600" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                                                Saldo AP {vendorBalance.vendorName}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-mono font-black text-lg text-amber-800">
                                                {formatIDR(vendorBalance.totalOutstanding)}
                                            </span>
                                            <span className="text-[10px] text-amber-600 ml-2">
                                                ({vendorBalance.billCount} tagihan)
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bill Allocation Table */}
                        {selectedVendorId && (
                            <div className={NB.section}>
                                <div className={NB.sectionHead + " justify-between"}>
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4" />
                                        <span className={NB.sectionTitle}>
                                            Alokasi Tagihan ({allocations.length})
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={selectAll}
                                            className="text-[9px] font-black uppercase tracking-widest h-7 px-2"
                                        >
                                            <Check className="h-3 w-3 mr-1" /> Pilih Semua
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={deselectAll}
                                            className="text-[9px] font-black uppercase tracking-widest h-7 px-2"
                                        >
                                            <Minus className="h-3 w-3 mr-1" /> Batal Semua
                                        </Button>
                                    </div>
                                </div>

                                {allocations.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <FileText className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                            Vendor ini tidak memiliki tagihan terbuka
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Table Header */}
                                        <div className={NB.tableHead}>
                                            <div className="grid grid-cols-12 gap-2 px-3 py-2">
                                                <div className={NB.tableHeadCell + " col-span-1"}></div>
                                                <div className={NB.tableHeadCell + " col-span-3"}>No. Tagihan</div>
                                                <div className={NB.tableHeadCell + " col-span-2"}>Jatuh Tempo</div>
                                                <div className={NB.tableHeadCell + " col-span-2 text-right"}>Total</div>
                                                <div className={NB.tableHeadCell + " col-span-2 text-right"}>Sisa</div>
                                                <div className={NB.tableHeadCell + " col-span-2 text-right"}>Bayar</div>
                                            </div>
                                        </div>

                                        {/* Rows */}
                                        {allocations.map((row) => (
                                            <div
                                                key={row.billId}
                                                className={
                                                    NB.tableRow +
                                                    " grid grid-cols-12 gap-2 items-center px-3 py-2" +
                                                    (row.selected ? " bg-emerald-50 dark:bg-emerald-950/30" : "") +
                                                    (row.isOverdue ? " border-l-4 border-l-red-400" : "")
                                                }
                                            >
                                                <div className="col-span-1 flex items-center justify-center">
                                                    <Checkbox
                                                        checked={row.selected}
                                                        onCheckedChange={() => toggleBill(row.billId)}
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <span className="font-mono text-xs font-bold">
                                                        {row.billNumber}
                                                    </span>
                                                    {row.isOverdue && (
                                                        <span className="ml-2 text-[9px] font-black uppercase text-red-600 bg-red-100 px-1.5 py-0.5">
                                                            Jatuh Tempo
                                                        </span>
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
                                                            onChange={(e) =>
                                                                updateAllocation(
                                                                    row.billId,
                                                                    Number(e.target.value)
                                                                )
                                                            }
                                                            max={row.balanceDue}
                                                            min={0}
                                                            className="border-2 border-black font-mono font-bold h-8 text-right rounded-none text-xs w-full"
                                                        />
                                                    ) : (
                                                        <div className="text-right text-xs text-zinc-300 font-mono">
                                                            -
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}

                        {/* Potong PPh Section */}
                        {selectedCount > 0 && (
                            <div className="border-2 border-black p-3 space-y-3">
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={enablePPh}
                                        onChange={(e) => setEnablePPh(e.target.checked)}
                                        className="rounded border-zinc-300"
                                    />
                                    Potong PPh
                                </label>

                                {enablePPh && (
                                    <div className="space-y-3 pl-6">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold uppercase text-zinc-500">Jenis PPh</label>
                                                <Select value={pphType} onValueChange={(v: string) => setPPhType(v as PPhTypeValue)}>
                                                    <SelectTrigger className="h-8 rounded-none text-xs border-2 border-black">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="PPH_23">PPh 23 (Jasa)</SelectItem>
                                                        <SelectItem value="PPH_4_2">PPh 4(2) (Sewa/Konstruksi)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold uppercase text-zinc-500">Tarif (%)</label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={pphRate}
                                                    onChange={(e) => setPPhRate(Number(e.target.value))}
                                                    className="h-8 rounded-none text-xs border-2 border-black font-mono"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <span className="text-zinc-500">DPP:</span>{" "}
                                                <span className="font-mono font-bold">{formatIDR(pphBaseAmount)}</span>
                                            </div>
                                            <div>
                                                <span className="text-zinc-500">PPh:</span>{" "}
                                                <span className="font-mono font-bold text-red-600">{formatIDR(pphCalc?.amount || 0)}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase text-zinc-500">No. Bukti Potong</label>
                                            <Input
                                                value={buktiPotongNo}
                                                onChange={(e) => setBuktiPotongNo(e.target.value)}
                                                placeholder="Opsional..."
                                                className="h-8 rounded-none text-xs border-2 border-black placeholder:text-zinc-300"
                                            />
                                        </div>

                                        <div className="bg-amber-50 border-2 border-amber-300 p-2 text-xs">
                                            <span className="font-bold">Dibayar ke vendor:</span>{" "}
                                            <span className="font-mono font-bold text-lg">{formatIDR(pphCalc?.netAmount || pphBaseAmount)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Payment Summary */}
                        {selectedCount > 0 && (
                            <div className="border-2 border-black bg-emerald-50 dark:bg-emerald-950 p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                            Ringkasan Pembayaran
                                        </span>
                                        <p className="text-xs text-emerald-600 mt-0.5">
                                            {selectedCount} tagihan dipilih
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 block">
                                            Total Bayar
                                        </span>
                                        <span className="font-mono font-black text-2xl text-emerald-800">
                                            {formatIDR(totalAllocated)}
                                        </span>
                                    </div>
                                </div>

                                {/* GL Entry Preview */}
                                <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-800">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 block mb-1">
                                        Jurnal Otomatis
                                    </span>
                                    <div className="grid grid-cols-3 gap-1 text-[10px] font-bold">
                                        <span className="text-emerald-700">Akun</span>
                                        <span className="text-emerald-700 text-right">Debit</span>
                                        <span className="text-emerald-700 text-right">Kredit</span>

                                        <span>2100 - Hutang Usaha</span>
                                        <span className="text-right font-mono">{formatIDR(totalAllocated)}</span>
                                        <span className="text-right font-mono">-</span>

                                        <span>{bankAccountCode} - {bankAccounts?.find(a => a.code === bankAccountCode)?.name || 'Cash/Bank'}</span>
                                        <span className="text-right font-mono">-</span>
                                        <span className="text-right font-mono">{formatIDR(enablePPh && pphCalc ? pphCalc.netAmount : totalAllocated)}</span>

                                        {enablePPh && pphCalc && pphCalc.amount > 0 && (
                                            <>
                                                <span className="text-red-600">
                                                    {pphType === "PPH_23" ? "2131 - Hutang PPh 23" : "2132 - Hutang PPh 4(2)"}
                                                </span>
                                                <span className="text-right font-mono">-</span>
                                                <span className="text-right font-mono text-red-600">{formatIDR(pphCalc.amount)}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {/* Footer */}
                <div className="px-6 py-4 border-t-2 border-black bg-zinc-50 dark:bg-zinc-800 flex items-center justify-between">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={resetAndClose}
                        className={NB.cancelBtn}
                    >
                        Batal
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting || selectedCount === 0 || totalAllocated <= 0}
                        className={NB.submitBtn + " bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40"}
                    >
                        <Banknote className="h-4 w-4 mr-2" />
                        {submitting
                            ? "Memproses..."
                            : `Bayar ${selectedCount} Tagihan — ${formatIDR(enablePPh && pphCalc ? pphCalc.netAmount : totalAllocated)}`}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { NB } from "@/lib/dialog-styles"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { IconPlus, IconTrash, IconFileInvoice, IconReceipt, IconCalendar } from "@tabler/icons-react"
import { createOpeningInvoices, getOpeningBalanceParties } from "@/lib/actions/finance-gl"
import type { OpeningInvoiceRow } from "@/lib/actions/finance-gl"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { motion, AnimatePresence } from "framer-motion"

interface PartyOption { id: string; name: string }

const emptyRow = (): OpeningInvoiceRow => ({ partyId: "", invoiceNumber: "", amount: 0, dueDate: "" })

export function OpeningBalancesAPAR() {
    const queryClient = useQueryClient()
    const [activeSection, setActiveSection] = useState<"AP" | "AR">("AP")
    const [customers, setCustomers] = useState<PartyOption[]>([])
    const [suppliers, setSuppliers] = useState<PartyOption[]>([])
    const [apRows, setApRows] = useState<OpeningInvoiceRow[]>([emptyRow(), emptyRow()])
    const [arRows, setArRows] = useState<OpeningInvoiceRow[]>([emptyRow(), emptyRow()])
    const [loading, setLoading] = useState(false)
    const [partiesLoading, setPartiesLoading] = useState(true)

    useEffect(() => {
        getOpeningBalanceParties().then((data) => { setCustomers(data.customers); setSuppliers(data.suppliers); setPartiesLoading(false) })
    }, [])

    const rows = activeSection === "AP" ? apRows : arRows
    const setRows = activeSection === "AP" ? setApRows : setArRows
    const parties = activeSection === "AP" ? suppliers : customers
    const partyLabel = activeSection === "AP" ? "Vendor" : "Pelanggan"

    const addRow = useCallback(() => { setRows((prev) => [...prev, emptyRow()]) }, [setRows])
    const removeRow = useCallback((idx: number) => { setRows((prev) => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)) }, [setRows])
    const updateRow = useCallback((idx: number, field: keyof OpeningInvoiceRow, value: string | number) => {
        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)))
    }, [setRows])

    const totalAmount = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
    const validRows = rows.filter(r => r.partyId && r.invoiceNumber.trim() && r.amount > 0 && r.dueDate)

    async function handleSubmit() {
        if (validRows.length === 0) { toast.error("Tidak ada baris yang valid"); return }
        setLoading(true)
        try {
            const result = await createOpeningInvoices({ type: activeSection, rows: validRows })
            if (result.success) {
                toast.success(`${result.createdCount} saldo awal ${activeSection === "AP" ? "hutang" : "piutang"} berhasil dibuat`)
                setRows([emptyRow(), emptyRow()])
                queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.bills.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.openingBalances.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.arPayments.all })
            } else { toast.error(result.error || "Gagal menyimpan") }
        } catch (err: any) { toast.error(err.message || "Terjadi kesalahan") }
        finally { setLoading(false) }
    }

    const accentGradient = activeSection === "AP"
        ? "from-red-500 via-rose-400 to-red-500"
        : "from-blue-500 via-sky-400 to-blue-500"
    const accentBg = activeSection === "AP"
        ? "bg-red-50/50 dark:bg-red-950/10"
        : "bg-blue-50/50 dark:bg-blue-950/10"

    return (
        <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
            {/* Accent bar — changes color with section */}
            <div className={`h-1 bg-gradient-to-r ${accentGradient}`} />

            {/* Instruction banner + Section toggle */}
            <div className={`px-5 py-3 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 ${accentBg}`}>
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {activeSection === "AP"
                        ? "Masukkan tagihan vendor yang belum terbayar saat migrasi. Status ISSUED, muncul di Hutang Usaha."
                        : "Masukkan piutang pelanggan yang belum tertagih saat migrasi. Status ISSUED, muncul di Piutang Usaha."}
                </p>
                <div className="flex items-center gap-0 shrink-0 ml-4">
                    <button
                        onClick={() => setActiveSection("AP")}
                        className={`flex items-center gap-1 h-8 px-3 border text-[10px] font-black uppercase tracking-wider rounded-none transition-all border-r-0 ${
                            activeSection === "AP"
                                ? "bg-red-500 text-white border-red-600"
                                : "bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50"
                        }`}
                    >
                        <IconReceipt size={12} /> AP
                    </button>
                    <button
                        onClick={() => setActiveSection("AR")}
                        className={`flex items-center gap-1 h-8 px-3 border text-[10px] font-black uppercase tracking-wider rounded-none transition-all ${
                            activeSection === "AR"
                                ? "bg-blue-500 text-white border-blue-600"
                                : "bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50"
                        }`}
                    >
                        <IconFileInvoice size={12} /> AR
                    </button>
                </div>
            </div>

            {/* Column Headers */}
            <div className="grid grid-cols-[36px_1fr_1fr_150px_130px_36px] gap-0 bg-zinc-50 dark:bg-zinc-800/50 border-b-2 border-black">
                <div className="px-2 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-center">#</div>
                <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">{partyLabel}</div>
                <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">No. Invoice</div>
                <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Jumlah (IDR)</div>
                <div className="px-2 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1"><IconCalendar size={10} /> Jatuh Tempo</div>
                <div />
            </div>

            {/* Data Rows */}
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                <AnimatePresence>
                    {rows.map((row, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="grid grid-cols-[36px_1fr_1fr_150px_130px_36px] gap-0 items-center group hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                        >
                            <div className="px-2 py-2 text-[11px] text-zinc-300 font-black text-center">{idx + 1}</div>
                            <div className="px-2 py-1.5">
                                <select
                                    value={row.partyId}
                                    onChange={(e) => updateRow(idx, "partyId", e.target.value)}
                                    className={`w-full h-8 text-xs font-bold border rounded-none px-2 transition-all ${
                                        row.partyId ? NB.inputActive : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                    }`}
                                    disabled={partiesLoading}
                                >
                                    <option value="">Pilih {partyLabel.toLowerCase()}...</option>
                                    {parties.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="px-2 py-1.5">
                                <input
                                    type="text"
                                    value={row.invoiceNumber}
                                    onChange={(e) => updateRow(idx, "invoiceNumber", e.target.value)}
                                    placeholder="INV-001..."
                                    className={`w-full h-8 text-xs font-bold border rounded-none px-2 transition-all ${
                                        row.invoiceNumber.trim() ? NB.inputActive : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                    }`}
                                />
                            </div>
                            <div className="px-2 py-1.5">
                                <input
                                    type="number"
                                    value={row.amount || ""}
                                    onChange={(e) => updateRow(idx, "amount", Number(e.target.value) || 0)}
                                    placeholder="0"
                                    className={`w-full h-8 text-xs font-mono font-bold text-right border rounded-none px-2 transition-all ${
                                        row.amount > 0 ? NB.inputActive : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-400"
                                    }`}
                                    min={0}
                                />
                            </div>
                            <div className="px-2 py-1.5">
                                <input
                                    type="date"
                                    value={row.dueDate}
                                    onChange={(e) => updateRow(idx, "dueDate", e.target.value)}
                                    className={`w-full h-8 text-xs font-bold border rounded-none px-2 transition-all ${
                                        row.dueDate ? NB.inputActive : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                    }`}
                                />
                            </div>
                            <div className="flex justify-center">
                                <button
                                    onClick={() => removeRow(idx)}
                                    className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-500 transition-all p-1"
                                    disabled={rows.length <= 1}
                                >
                                    <IconTrash size={13} />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Footer: Add Row + Total + Submit */}
            <div className="px-5 py-3 flex items-center justify-between border-t-2 border-black">
                <button onClick={addRow} className={`${NB.toolbarBtn} flex items-center gap-1.5`}>
                    <IconPlus size={14} /> Tambah Baris
                </button>

                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">
                            Total {activeSection === "AP" ? "Hutang" : "Piutang"}
                        </span>
                        <span className={`text-lg font-black font-mono tabular-nums ${activeSection === "AP" ? "text-red-600" : "text-blue-600"}`}>
                            {formatIDR(totalAmount)}
                        </span>
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || validRows.length === 0}
                        className={`${activeSection === "AP" ? NB.submitBtn : NB.submitBtnBlue} disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none`}
                    >
                        {loading ? "Menyimpan..." : `Simpan ${validRows.length} Saldo Awal`}
                    </button>
                </div>
            </div>
        </div>
    )
}

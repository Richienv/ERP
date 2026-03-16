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

interface PartyOption {
    id: string
    name: string
}

const emptyRow = (): OpeningInvoiceRow => ({
    partyId: "",
    invoiceNumber: "",
    amount: 0,
    dueDate: "",
})

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
        getOpeningBalanceParties().then((data) => {
            setCustomers(data.customers)
            setSuppliers(data.suppliers)
            setPartiesLoading(false)
        })
    }, [])

    const rows = activeSection === "AP" ? apRows : arRows
    const setRows = activeSection === "AP" ? setApRows : setArRows
    const parties = activeSection === "AP" ? suppliers : customers
    const partyLabel = activeSection === "AP" ? "Vendor" : "Pelanggan"
    const accentColor = activeSection === "AP" ? "red" : "blue"

    const addRow = useCallback(() => {
        setRows((prev) => [...prev, emptyRow()])
    }, [setRows])

    const removeRow = useCallback((idx: number) => {
        setRows((prev) => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx))
    }, [setRows])

    const updateRow = useCallback((idx: number, field: keyof OpeningInvoiceRow, value: string | number) => {
        setRows((prev) =>
            prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
        )
    }, [setRows])

    const totalAmount = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
    const validRows = rows.filter(r => r.partyId && r.invoiceNumber.trim() && r.amount > 0 && r.dueDate)

    async function handleSubmit() {
        if (validRows.length === 0) {
            toast.error("Tidak ada baris yang valid untuk disimpan")
            return
        }
        setLoading(true)
        try {
            const result = await createOpeningInvoices({
                type: activeSection,
                rows: validRows,
            })
            if (result.success) {
                toast.success(`${result.createdCount} saldo awal ${activeSection === "AP" ? "hutang" : "piutang"} berhasil dibuat`)
                setRows([emptyRow(), emptyRow()])
                queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.bills.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.openingBalances.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.arPayments.all })
            } else {
                toast.error(result.error || "Gagal menyimpan")
            }
        } catch (err: any) {
            toast.error(err.message || "Terjadi kesalahan")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-0">
            {/* ─── Section Toggle + Info ─── */}
            <div className={NB.pageCard}>
                <div className={`h-1 bg-gradient-to-r ${activeSection === "AP" ? "from-red-500 via-rose-400 to-red-500" : "from-blue-500 via-sky-400 to-blue-500"}`} />

                <div className="px-5 py-4 flex items-start gap-4">
                    <div className={`w-10 h-10 flex items-center justify-center shrink-0 mt-0.5 ${activeSection === "AP" ? "bg-red-500" : "bg-blue-500"}`}>
                        {activeSection === "AP" ? <IconReceipt size={20} className="text-white" /> : <IconFileInvoice size={20} className="text-white" />}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <button
                                onClick={() => setActiveSection("AP")}
                                className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 border-2 transition-all ${
                                    activeSection === "AP"
                                        ? "bg-red-500 text-white border-red-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.15)]"
                                        : "bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                }`}
                            >
                                <span className="flex items-center gap-1.5"><IconReceipt size={12} /> Hutang (AP)</span>
                            </button>
                            <button
                                onClick={() => setActiveSection("AR")}
                                className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 border-2 transition-all ${
                                    activeSection === "AR"
                                        ? "bg-blue-500 text-white border-blue-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.15)]"
                                        : "bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                }`}
                            >
                                <span className="flex items-center gap-1.5"><IconFileInvoice size={12} /> Piutang (AR)</span>
                            </button>
                        </div>
                        <p className="text-zinc-500 text-xs font-medium leading-relaxed">
                            {activeSection === "AP"
                                ? "Masukkan tagihan vendor (bill) yang belum terbayar pada saat migrasi. Invoice akan dibuat dengan status ISSUED dan muncul di halaman Hutang Usaha."
                                : "Masukkan piutang pelanggan (invoice) yang belum tertagih pada saat migrasi. Invoice akan dibuat dengan status ISSUED dan muncul di halaman Piutang Usaha."
                            }
                        </p>
                    </div>
                </div>
            </div>

            {/* ─── Entry Table ─── */}
            <div className={NB.pageCard}>
                <div className="h-0.5 bg-zinc-200 dark:bg-zinc-700" />

                {/* Column Headers */}
                <div className={`grid grid-cols-[40px_1fr_1fr_160px_140px_40px] gap-0 ${activeSection === "AP" ? "bg-red-900" : "bg-blue-900"}`}>
                    <div className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-400">#</div>
                    <div className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-300">{partyLabel}</div>
                    <div className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-300">No. Invoice</div>
                    <div className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-300 text-right">Jumlah (IDR)</div>
                    <div className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-300 flex items-center gap-1"><IconCalendar size={10} /> Jatuh Tempo</div>
                    <div />
                </div>

                {/* Data Rows */}
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    <AnimatePresence>
                        {rows.map((row, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className={`grid grid-cols-[40px_1fr_1fr_160px_140px_40px] gap-0 items-center group hover:bg-orange-50/30 dark:hover:bg-orange-950/10 transition-colors ${
                                    row.partyId ? "bg-white dark:bg-zinc-900" : "bg-zinc-50/50 dark:bg-zinc-900/50"
                                }`}
                            >
                                <div className="px-3 py-2 text-xs text-zinc-300 font-black">{idx + 1}</div>
                                <div className="px-2 py-1.5">
                                    <select
                                        value={row.partyId}
                                        onChange={(e) => updateRow(idx, "partyId", e.target.value)}
                                        className={`w-full h-8 text-xs font-bold border rounded-none px-2 transition-all ${
                                            row.partyId
                                                ? "border-orange-400 bg-orange-50/50 dark:border-orange-500 dark:bg-orange-950/20"
                                                : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
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
                                            row.invoiceNumber.trim()
                                                ? "border-orange-400 bg-orange-50/50 dark:border-orange-500 dark:bg-orange-950/20"
                                                : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
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
                                            row.amount > 0
                                                ? `border-${accentColor}-400 bg-${accentColor}-50/50 text-${accentColor}-700 dark:border-${accentColor}-500 dark:bg-${accentColor}-950/20 dark:text-${accentColor}-400`
                                                : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-400"
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
                                            row.dueDate
                                                ? "border-orange-400 bg-orange-50/50 dark:border-orange-500 dark:bg-orange-950/20"
                                                : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                        }`}
                                    />
                                </div>
                                <div className="px-2 py-1.5 flex justify-center">
                                    <button
                                        onClick={() => removeRow(idx)}
                                        className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-500 transition-all"
                                        disabled={rows.length <= 1}
                                    >
                                        <IconTrash size={14} />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Actions Bar */}
                <div className="px-5 py-3 flex items-center justify-between bg-white dark:bg-zinc-900 border-t-2 border-black">
                    <button
                        onClick={addRow}
                        className={`${NB.toolbarBtn} flex items-center gap-1.5`}
                    >
                        <IconPlus size={14} />
                        Tambah Baris
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
        </div>
    )
}

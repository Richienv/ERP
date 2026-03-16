"use client"

import { useState, useEffect, useCallback } from "react"
import { NB } from "@/lib/dialog-styles"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { IconPlus, IconTrash, IconFileInvoice, IconReceipt } from "@tabler/icons-react"
import { createOpeningInvoices, getOpeningBalanceParties } from "@/lib/actions/finance-gl"
import type { OpeningInvoiceRow } from "@/lib/actions/finance-gl"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

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
    const [apRows, setApRows] = useState<OpeningInvoiceRow[]>([emptyRow()])
    const [arRows, setArRows] = useState<OpeningInvoiceRow[]>([emptyRow()])
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
                setRows([emptyRow()])
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
        <div className="space-y-6">
            {/* Section toggle */}
            <div className="flex gap-3">
                <button
                    onClick={() => setActiveSection("AP")}
                    className={`flex items-center gap-2 px-5 py-2.5 border-2 border-black font-black uppercase text-xs tracking-wider transition-all ${
                        activeSection === "AP"
                            ? "bg-red-500 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                            : "bg-white hover:bg-zinc-50"
                    }`}
                >
                    <IconReceipt size={16} />
                    Hutang Usaha (AP)
                </button>
                <button
                    onClick={() => setActiveSection("AR")}
                    className={`flex items-center gap-2 px-5 py-2.5 border-2 border-black font-black uppercase text-xs tracking-wider transition-all ${
                        activeSection === "AR"
                            ? "bg-blue-500 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                            : "bg-white hover:bg-zinc-50"
                    }`}
                >
                    <IconFileInvoice size={16} />
                    Piutang Usaha (AR)
                </button>
            </div>

            {/* Info banner */}
            <div className={`border-2 border-black p-4 ${activeSection === "AP" ? "bg-red-50 border-l-[6px] border-l-red-500" : "bg-blue-50 border-l-[6px] border-l-blue-500"}`}>
                <p className="text-sm font-bold">
                    {activeSection === "AP"
                        ? "Masukkan tagihan vendor (bill) yang belum terbayar pada saat migrasi. Invoice akan dibuat dengan status ISSUED dan muncul di halaman Hutang Usaha."
                        : "Masukkan piutang pelanggan (invoice) yang belum tertagih pada saat migrasi. Invoice akan dibuat dengan status ISSUED dan muncul di halaman Piutang Usaha."
                    }
                </p>
            </div>

            {/* Table */}
            <div className={NB.tableWrap}>
                <table className="w-full">
                    <thead>
                        <tr className={NB.tableHead}>
                            <th className={`${NB.tableHeadCell} w-8 text-center`}>#</th>
                            <th className={`${NB.tableHeadCell} min-w-[200px]`}>{partyLabel}</th>
                            <th className={`${NB.tableHeadCell} min-w-[180px]`}>No. Invoice</th>
                            <th className={`${NB.tableHeadCell} min-w-[160px] text-right`}>Jumlah (IDR)</th>
                            <th className={`${NB.tableHeadCell} min-w-[160px]`}>Jatuh Tempo</th>
                            <th className={`${NB.tableHeadCell} w-12`} />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, idx) => (
                            <tr key={idx} className={NB.tableRow}>
                                <td className={`${NB.tableCell} text-center text-xs text-zinc-400 font-bold`}>{idx + 1}</td>
                                <td className={NB.tableCell}>
                                    <select
                                        value={row.partyId}
                                        onChange={(e) => updateRow(idx, "partyId", e.target.value)}
                                        className={`${NB.select} text-sm ${row.partyId ? NB.inputActive : NB.inputEmpty}`}
                                        disabled={partiesLoading}
                                    >
                                        <option value="">-- Pilih {partyLabel} --</option>
                                        {parties.map((p) => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className={NB.tableCell}>
                                    <input
                                        type="text"
                                        value={row.invoiceNumber}
                                        onChange={(e) => updateRow(idx, "invoiceNumber", e.target.value)}
                                        placeholder="INV-001..."
                                        className={`${NB.input} w-full text-sm ${row.invoiceNumber.trim() ? NB.inputActive : NB.inputEmpty}`}
                                    />
                                </td>
                                <td className={NB.tableCell}>
                                    <input
                                        type="number"
                                        value={row.amount || ""}
                                        onChange={(e) => updateRow(idx, "amount", Number(e.target.value) || 0)}
                                        placeholder="0"
                                        className={`${NB.inputMono} w-full text-sm text-right ${row.amount > 0 ? NB.inputActive : NB.inputEmpty}`}
                                        min={0}
                                    />
                                </td>
                                <td className={NB.tableCell}>
                                    <input
                                        type="date"
                                        value={row.dueDate}
                                        onChange={(e) => updateRow(idx, "dueDate", e.target.value)}
                                        className={`${NB.input} w-full text-sm ${row.dueDate ? NB.inputActive : NB.inputEmpty}`}
                                    />
                                </td>
                                <td className={NB.tableCell}>
                                    <button
                                        onClick={() => removeRow(idx)}
                                        className="text-zinc-400 hover:text-red-500 transition-colors"
                                        disabled={rows.length <= 1}
                                    >
                                        <IconTrash size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between">
                <button
                    onClick={addRow}
                    className="flex items-center gap-1.5 px-4 py-2 border-2 border-black bg-white hover:bg-zinc-50 font-black uppercase text-xs tracking-wider transition-all"
                >
                    <IconPlus size={14} />
                    Tambah Baris
                </button>

                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Total {activeSection === "AP" ? "Hutang" : "Piutang"}</span>
                        <p className="text-lg font-black font-mono">{formatIDR(totalAmount)}</p>
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || validRows.length === 0}
                        className={`${NB.submitBtn} px-8 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {loading ? "Menyimpan..." : `Simpan ${validRows.length} Saldo Awal`}
                    </button>
                </div>
            </div>
        </div>
    )
}

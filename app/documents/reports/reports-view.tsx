"use client"

import { useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import {
    Search,
    FileBarChart,
    FileText,
    Receipt,
    ClipboardCheck,
    Banknote,
    Download,
    ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type DocumentRow = {
    id: string
    number?: string
    status: string
    date?: string | Date
    updatedAt: string | Date
    partnerName?: string
    totalAmount?: number
    viewUrl: string
    warehouse?: string
    purchaseOrderNumber?: string
    period?: string
    periodLabel?: string
    type?: string
}

type DocumentsMeta = {
    page: number
    pageSize: number
    total: number
    totalPages: number
}

type DocumentsQuery = {
    q: string | null
    status: string | null
    type: string | null
    from: string | null
    to: string | null
    page: number
    pageSize: number
}

interface ReportsViewProps {
    documents: {
        purchaseOrders: DocumentRow[]
        invoices: DocumentRow[]
        goodsReceipts: DocumentRow[]
        payrollRuns: DocumentRow[]
    }
    documentsMeta: {
        purchaseOrders: DocumentsMeta
        invoices: DocumentsMeta
        goodsReceipts: DocumentsMeta
        payrollRuns: DocumentsMeta
    }
    documentsQuery: {
        purchaseOrders: DocumentsQuery
        invoices: DocumentsQuery
        goodsReceipts: DocumentsQuery
        payrollRuns: DocumentsQuery
    }
}

const formatDateTime = (value: string | Date | undefined) => {
    if (!value) return "-"
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return "-"
    return date.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

const formatCurrency = (amount?: number) => {
    const safeAmount = Number(amount || 0)
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(safeAmount)
}

const getStatusColor = (status: string) => {
    switch (status) {
        case "COMPLETED": case "ACCEPTED": case "PAID": case "POSTED":
            return "bg-emerald-50 text-emerald-700 border-emerald-300"
        case "DRAFT": case "PENDING": case "PENDING_APPROVAL":
            return "bg-amber-50 text-amber-700 border-amber-300"
        case "APPROVED": case "ORDERED": case "ISSUED": case "SHIPPED":
            return "bg-blue-50 text-blue-700 border-blue-300"
        case "REJECTED": case "VOID": case "CANCELLED":
            return "bg-red-50 text-red-600 border-red-300"
        default:
            return "bg-zinc-100 text-zinc-600 border-zinc-300"
    }
}

const downloadCsv = (filename: string, headers: string[], rows: Array<Array<string | number>>) => {
    const escapeCell = (value: string) => `"${value.replace(/"/g, '""')}"`
    const csvContent = [headers, ...rows]
        .map((row) => row.map((cell) => escapeCell(String(cell ?? ""))).join(","))
        .join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

type TabKey = "po" | "invoice" | "grn" | "payroll"

export function ReportsView({ documents, documentsMeta, documentsQuery }: ReportsViewProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [activeTab, setActiveTab] = useState<TabKey>("po")

    // PO state
    const [poSearch, setPoSearch] = useState(documentsQuery.purchaseOrders.q || "")
    const [poStatus, setPoStatus] = useState(documentsQuery.purchaseOrders.status || "")
    const [poFrom, setPoFrom] = useState(documentsQuery.purchaseOrders.from || "")
    const [poTo, setPoTo] = useState(documentsQuery.purchaseOrders.to || "")
    const poPage = documentsMeta.purchaseOrders.page
    const poTotalPages = documentsMeta.purchaseOrders.totalPages || 1

    // Invoice state
    const [invSearch, setInvSearch] = useState(documentsQuery.invoices.q || "")
    const [invStatus, setInvStatus] = useState(documentsQuery.invoices.status || "")
    const [invType, setInvType] = useState(documentsQuery.invoices.type || "")
    const [invFrom, setInvFrom] = useState(documentsQuery.invoices.from || "")
    const [invTo, setInvTo] = useState(documentsQuery.invoices.to || "")
    const invPage = documentsMeta.invoices.page
    const invTotalPages = documentsMeta.invoices.totalPages || 1

    // GRN state
    const [grnSearch, setGrnSearch] = useState(documentsQuery.goodsReceipts.q || "")
    const [grnStatus, setGrnStatus] = useState(documentsQuery.goodsReceipts.status || "")
    const [grnFrom, setGrnFrom] = useState(documentsQuery.goodsReceipts.from || "")
    const [grnTo, setGrnTo] = useState(documentsQuery.goodsReceipts.to || "")
    const grnPage = documentsMeta.goodsReceipts.page
    const grnTotalPages = documentsMeta.goodsReceipts.totalPages || 1

    // Payroll state
    const [paySearch, setPaySearch] = useState(documentsQuery.payrollRuns.q || "")
    const [payStatus, setPayStatus] = useState(documentsQuery.payrollRuns.status || "")
    const [payFrom, setPayFrom] = useState(documentsQuery.payrollRuns.from || "")
    const [payTo, setPayTo] = useState(documentsQuery.payrollRuns.to || "")
    const payPage = documentsMeta.payrollRuns.page
    const payTotalPages = documentsMeta.payrollRuns.totalPages || 1

    const pushParams = (mutator: (p: URLSearchParams) => void) => {
        const params = new URLSearchParams(searchParams.toString())
        mutator(params)
        const qs = params.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname)
    }

    const setOrDel = (p: URLSearchParams, k: string, v: string | null) => {
        if (!v) p.delete(k); else p.set(k, v)
    }

    const applyPo = (page?: number) => pushParams(p => {
        setOrDel(p, "po_q", poSearch || null)
        setOrDel(p, "po_status", poStatus || null)
        setOrDel(p, "po_from", poFrom || null)
        setOrDel(p, "po_to", poTo || null)
        p.set("po_page", String(page || 1))
    })
    const applyInv = (page?: number) => pushParams(p => {
        setOrDel(p, "inv_q", invSearch || null)
        setOrDel(p, "inv_status", invStatus || null)
        setOrDel(p, "inv_type", invType || null)
        setOrDel(p, "inv_from", invFrom || null)
        setOrDel(p, "inv_to", invTo || null)
        p.set("inv_page", String(page || 1))
    })
    const applyGrn = (page?: number) => pushParams(p => {
        setOrDel(p, "grn_q", grnSearch || null)
        setOrDel(p, "grn_status", grnStatus || null)
        setOrDel(p, "grn_from", grnFrom || null)
        setOrDel(p, "grn_to", grnTo || null)
        p.set("grn_page", String(page || 1))
    })
    const applyPay = (page?: number) => pushParams(p => {
        setOrDel(p, "pay_q", paySearch || null)
        setOrDel(p, "pay_status", payStatus || null)
        setOrDel(p, "pay_from", payFrom || null)
        setOrDel(p, "pay_to", payTo || null)
        p.set("pay_page", String(page || 1))
    })

    const getRangeLabel = (total: number, page: number, pageSize: number) => {
        if (total === 0) return "0"
        const start = (page - 1) * pageSize + 1
        const end = Math.min(total, start + pageSize - 1)
        return `${start}-${end}`
    }

    const exportPoCsv = () => {
        if (documents.purchaseOrders.length === 0) return
        downloadCsv(`po-registry-${new Date().toISOString().slice(0, 10)}.csv`,
            ["No PO", "Vendor", "Status", "Total", "Update"],
            documents.purchaseOrders.map(r => [r.number || "", r.partnerName || "", r.status, r.totalAmount || 0, new Date(r.updatedAt).toISOString()])
        )
    }
    const exportInvCsv = () => {
        if (documents.invoices.length === 0) return
        downloadCsv(`invoice-registry-${new Date().toISOString().slice(0, 10)}.csv`,
            ["No Invoice", "Partner", "Tipe", "Status", "Total", "Update"],
            documents.invoices.map(r => [r.number || "", r.partnerName || "", r.type || "-", r.status, r.totalAmount || 0, new Date(r.updatedAt).toISOString()])
        )
    }
    const exportGrnCsv = () => {
        if (documents.goodsReceipts.length === 0) return
        downloadCsv(`grn-registry-${new Date().toISOString().slice(0, 10)}.csv`,
            ["No SJ Masuk", "No PO", "Gudang", "Status", "Update"],
            documents.goodsReceipts.map(r => [r.number || "", r.purchaseOrderNumber || "", r.warehouse || "", r.status, new Date(r.updatedAt).toISOString()])
        )
    }
    const exportPayCsv = () => {
        if (documents.payrollRuns.length === 0) return
        downloadCsv(`payroll-registry-${new Date().toISOString().slice(0, 10)}.csv`,
            ["Periode", "Status", "Update"],
            documents.payrollRuns.map(r => [r.periodLabel || r.period || "", r.status, new Date(r.updatedAt).toISOString()])
        )
    }

    const tabs: { key: TabKey; label: string; count: number; icon: typeof FileText }[] = [
        { key: "po", label: "Purchase Order", count: documentsMeta.purchaseOrders.total, icon: FileText },
        { key: "invoice", label: "Invoice", count: documentsMeta.invoices.total, icon: Receipt },
        { key: "grn", label: "Surat Jalan Masuk", count: documentsMeta.goodsReceipts.total, icon: ClipboardCheck },
        { key: "payroll", label: "Payroll", count: documentsMeta.payrollRuns.total, icon: Banknote },
    ]

    return (
        <div className="mf-page">
            {/* ═══ COMMAND HEADER ═══ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-violet-400">
                    <div className="flex items-center gap-3">
                        <FileBarChart className="h-5 w-5 text-violet-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Laporan Sistem
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Registrasi dokumen operasional lintas modul ERP
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ KPI PULSE STRIP ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Purchase Order</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-blue-600">{documentsMeta.purchaseOrders.total}</div>
                        <div className="text-[10px] font-bold text-blue-600 mt-1">Dokumen PO</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Receipt className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Invoice</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-emerald-600">{documentsMeta.invoices.total}</div>
                        <div className="text-[10px] font-bold text-emerald-600 mt-1">Dokumen Faktur</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <ClipboardCheck className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">SJ Masuk</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-amber-600">{documentsMeta.goodsReceipts.total}</div>
                        <div className="text-[10px] font-bold text-amber-600 mt-1">Penerimaan Barang</div>
                    </div>
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Banknote className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Payroll</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-indigo-600">{documentsMeta.payrollRuns.total}</div>
                        <div className="text-[10px] font-bold text-indigo-600 mt-1">Periode Gaji</div>
                    </div>
                </div>
            </div>

            {/* ═══ TAB BAR ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all border-2 border-black flex items-center gap-1.5 ${
                                activeTab === tab.key ? "bg-black text-white" : "bg-white text-zinc-400 hover:bg-zinc-50"
                            }`}
                        >
                            {tab.label}
                            <span className={`text-[9px] px-1.5 ${activeTab === tab.key ? "bg-white/20" : "bg-zinc-200"} rounded-full`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ═══ PO TAB ═══ */}
            {activeTab === "po" && (
                <>
                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                        <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
                            <div className="relative flex-1 max-w-xs">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                <Input placeholder="Cari No. PO atau vendor..." value={poSearch} onChange={e => setPoSearch(e.target.value)} className="pl-9 border-2 border-black font-bold h-10 placeholder:text-zinc-400 rounded-none" />
                            </div>
                            <select value={poStatus} onChange={e => setPoStatus(e.target.value)} className="border-2 border-black h-10 px-3 text-xs font-bold bg-white rounded-none">
                                <option value="">Semua Status</option>
                                <option value="PO_DRAFT">Draft</option>
                                <option value="APPROVED">Approved</option>
                                <option value="ORDERED">Ordered</option>
                                <option value="COMPLETED">Completed</option>
                                <option value="CANCELLED">Cancelled</option>
                            </select>
                            <input type="date" value={poFrom} onChange={e => setPoFrom(e.target.value)} className="border-2 border-black h-10 px-3 text-xs font-bold bg-white rounded-none" />
                            <input type="date" value={poTo} onChange={e => setPoTo(e.target.value)} className="border-2 border-black h-10 px-3 text-xs font-bold bg-white rounded-none" />
                            <Button onClick={() => applyPo()} className="border-2 border-black bg-black text-white font-black uppercase text-[10px] tracking-widest h-10 rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all">
                                Terapkan
                            </Button>
                            <Button onClick={exportPoCsv} variant="outline" className="border-2 border-black font-black uppercase text-[10px] tracking-widest h-10 rounded-none ml-auto">
                                <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
                            </Button>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-zinc-50 dark:bg-zinc-800 border-b-2 border-black">
                                    <tr>
                                        <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">No. PO</th>
                                        <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Vendor</th>
                                        <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</th>
                                        <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Total</th>
                                        <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Update</th>
                                        <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {documents.purchaseOrders.map(row => (
                                        <tr key={row.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                            <td className="p-4 font-mono font-bold text-xs text-blue-600">{row.number}</td>
                                            <td className="p-4 font-bold text-xs text-zinc-900 dark:text-white">{row.partnerName || "-"}</td>
                                            <td className="p-4">
                                                <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest border rounded-sm ${getStatusColor(row.status)}`}>{row.status}</span>
                                            </td>
                                            <td className="p-4 text-right font-black text-xs">{formatCurrency(row.totalAmount)}</td>
                                            <td className="p-4 text-zinc-500 text-xs font-medium">{formatDateTime(row.updatedAt)}</td>
                                            <td className="p-4 text-right">
                                                <a href={row.viewUrl} target="_blank" rel="noreferrer">
                                                    <Button variant="outline" size="sm" className="border-2 border-black text-[10px] font-black uppercase tracking-widest h-7 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                                                        <ExternalLink className="h-3 w-3 mr-1" /> PDF
                                                    </Button>
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                    {documents.purchaseOrders.length === 0 && (
                                        <tr><td colSpan={6} className="p-12 text-center">
                                            <FileText className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Belum ada dokumen PO</p>
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] px-4 py-3 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-500">Menampilkan {getRangeLabel(documentsMeta.purchaseOrders.total, poPage, documentsMeta.purchaseOrders.pageSize)} dari {documentsMeta.purchaseOrders.total} dokumen</span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => applyPo(Math.max(1, poPage - 1))} disabled={poPage <= 1} className="border-2 border-black px-3 py-1.5 text-[10px] font-black uppercase disabled:opacity-30 bg-white hover:bg-zinc-50 transition-colors">Prev</button>
                            <span className="text-[10px] font-black px-2">Hal {poPage}/{poTotalPages}</span>
                            <button onClick={() => applyPo(Math.min(poTotalPages, poPage + 1))} disabled={poPage >= poTotalPages} className="border-2 border-black px-3 py-1.5 text-[10px] font-black uppercase disabled:opacity-30 bg-white hover:bg-zinc-50 transition-colors">Next</button>
                        </div>
                    </div>
                </>
            )}

            {/* ═══ INVOICE TAB ═══ */}
            {activeTab === "invoice" && (
                <>
                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                        <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
                            <div className="relative flex-1 max-w-xs">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                <Input placeholder="Cari No. Invoice atau partner..." value={invSearch} onChange={e => setInvSearch(e.target.value)} className="pl-9 border-2 border-black font-bold h-10 placeholder:text-zinc-400 rounded-none" />
                            </div>
                            <select value={invStatus} onChange={e => setInvStatus(e.target.value)} className="border-2 border-black h-10 px-3 text-xs font-bold bg-white rounded-none">
                                <option value="">Semua Status</option>
                                <option value="DRAFT">Draft</option>
                                <option value="ISSUED">Issued</option>
                                <option value="PAID">Paid</option>
                                <option value="OVERDUE">Overdue</option>
                                <option value="VOID">Void</option>
                            </select>
                            <select value={invType} onChange={e => setInvType(e.target.value)} className="border-2 border-black h-10 px-3 text-xs font-bold bg-white rounded-none">
                                <option value="">Semua Tipe</option>
                                <option value="INV_OUT">Invoice (AR)</option>
                                <option value="INV_IN">Bill (AP)</option>
                            </select>
                            <input type="date" value={invFrom} onChange={e => setInvFrom(e.target.value)} className="border-2 border-black h-10 px-3 text-xs font-bold bg-white rounded-none" />
                            <input type="date" value={invTo} onChange={e => setInvTo(e.target.value)} className="border-2 border-black h-10 px-3 text-xs font-bold bg-white rounded-none" />
                            <Button onClick={() => applyInv()} className="border-2 border-black bg-black text-white font-black uppercase text-[10px] tracking-widest h-10 rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all">
                                Terapkan
                            </Button>
                            <Button onClick={exportInvCsv} variant="outline" className="border-2 border-black font-black uppercase text-[10px] tracking-widest h-10 rounded-none ml-auto">
                                <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
                            </Button>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-zinc-50 dark:bg-zinc-800 border-b-2 border-black">
                                    <tr>
                                        <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">No. Invoice</th>
                                        <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Partner</th>
                                        <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Tipe</th>
                                        <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</th>
                                        <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Total</th>
                                        <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Update</th>
                                        <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {documents.invoices.map(row => (
                                        <tr key={row.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                            <td className="p-4 font-mono font-bold text-xs text-emerald-600">{row.number}</td>
                                            <td className="p-4 font-bold text-xs text-zinc-900 dark:text-white">{row.partnerName || "-"}</td>
                                            <td className="p-4">
                                                <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest border rounded-sm ${row.type === 'INV_IN' ? 'bg-orange-50 text-orange-700 border-orange-300' : 'bg-cyan-50 text-cyan-700 border-cyan-300'}`}>
                                                    {row.type === 'INV_IN' ? 'AP' : 'AR'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest border rounded-sm ${getStatusColor(row.status)}`}>{row.status}</span>
                                            </td>
                                            <td className="p-4 text-right font-black text-xs">{formatCurrency(row.totalAmount)}</td>
                                            <td className="p-4 text-zinc-500 text-xs font-medium">{formatDateTime(row.updatedAt)}</td>
                                            <td className="p-4 text-right">
                                                <a href={row.viewUrl} target="_blank" rel="noreferrer">
                                                    <Button variant="outline" size="sm" className="border-2 border-black text-[10px] font-black uppercase tracking-widest h-7 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                                                        <ExternalLink className="h-3 w-3 mr-1" /> Buka
                                                    </Button>
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                    {documents.invoices.length === 0 && (
                                        <tr><td colSpan={7} className="p-12 text-center">
                                            <Receipt className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Belum ada dokumen invoice</p>
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] px-4 py-3 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-500">Menampilkan {getRangeLabel(documentsMeta.invoices.total, invPage, documentsMeta.invoices.pageSize)} dari {documentsMeta.invoices.total} dokumen</span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => applyInv(Math.max(1, invPage - 1))} disabled={invPage <= 1} className="border-2 border-black px-3 py-1.5 text-[10px] font-black uppercase disabled:opacity-30 bg-white hover:bg-zinc-50 transition-colors">Prev</button>
                            <span className="text-[10px] font-black px-2">Hal {invPage}/{invTotalPages}</span>
                            <button onClick={() => applyInv(Math.min(invTotalPages, invPage + 1))} disabled={invPage >= invTotalPages} className="border-2 border-black px-3 py-1.5 text-[10px] font-black uppercase disabled:opacity-30 bg-white hover:bg-zinc-50 transition-colors">Next</button>
                        </div>
                    </div>
                </>
            )}

            {/* ═══ GRN TAB ═══ */}
            {activeTab === "grn" && (
                <>
                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                        <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
                            <div className="relative flex-1 max-w-xs">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                <Input placeholder="Cari No. SJ Masuk, PO, atau gudang..." value={grnSearch} onChange={e => setGrnSearch(e.target.value)} className="pl-9 border-2 border-black font-bold h-10 placeholder:text-zinc-400 rounded-none" />
                            </div>
                            <select value={grnStatus} onChange={e => setGrnStatus(e.target.value)} className="border-2 border-black h-10 px-3 text-xs font-bold bg-white rounded-none">
                                <option value="">Semua Status</option>
                                <option value="DRAFT">Draft</option>
                                <option value="ACCEPTED">Accepted</option>
                                <option value="REJECTED">Rejected</option>
                            </select>
                            <input type="date" value={grnFrom} onChange={e => setGrnFrom(e.target.value)} className="border-2 border-black h-10 px-3 text-xs font-bold bg-white rounded-none" />
                            <input type="date" value={grnTo} onChange={e => setGrnTo(e.target.value)} className="border-2 border-black h-10 px-3 text-xs font-bold bg-white rounded-none" />
                            <Button onClick={() => applyGrn()} className="border-2 border-black bg-black text-white font-black uppercase text-[10px] tracking-widest h-10 rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all">
                                Terapkan
                            </Button>
                            <Button onClick={exportGrnCsv} variant="outline" className="border-2 border-black font-black uppercase text-[10px] tracking-widest h-10 rounded-none ml-auto">
                                <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
                            </Button>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-zinc-50 dark:bg-zinc-800 border-b-2 border-black">
                                    <tr>
                                        <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">No. SJ Masuk</th>
                                        <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">No. PO</th>
                                        <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Gudang</th>
                                        <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</th>
                                        <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Update</th>
                                        <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {documents.goodsReceipts.map(row => (
                                        <tr key={row.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                            <td className="p-4 font-mono font-bold text-xs text-amber-600">{row.number}</td>
                                            <td className="p-4 font-mono font-medium text-xs text-blue-600">{row.purchaseOrderNumber || "-"}</td>
                                            <td className="p-4 font-bold text-xs text-zinc-900 dark:text-white">{row.warehouse || "-"}</td>
                                            <td className="p-4">
                                                <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest border rounded-sm ${getStatusColor(row.status)}`}>{row.status}</span>
                                            </td>
                                            <td className="p-4 text-zinc-500 text-xs font-medium">{formatDateTime(row.updatedAt)}</td>
                                            <td className="p-4 text-right">
                                                <a href={row.viewUrl} target="_blank" rel="noreferrer">
                                                    <Button variant="outline" size="sm" className="border-2 border-black text-[10px] font-black uppercase tracking-widest h-7 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                                                        <ExternalLink className="h-3 w-3 mr-1" /> Buka
                                                    </Button>
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                    {documents.goodsReceipts.length === 0 && (
                                        <tr><td colSpan={6} className="p-12 text-center">
                                            <ClipboardCheck className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Belum ada dokumen penerimaan barang</p>
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] px-4 py-3 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-500">Menampilkan {getRangeLabel(documentsMeta.goodsReceipts.total, grnPage, documentsMeta.goodsReceipts.pageSize)} dari {documentsMeta.goodsReceipts.total} dokumen</span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => applyGrn(Math.max(1, grnPage - 1))} disabled={grnPage <= 1} className="border-2 border-black px-3 py-1.5 text-[10px] font-black uppercase disabled:opacity-30 bg-white hover:bg-zinc-50 transition-colors">Prev</button>
                            <span className="text-[10px] font-black px-2">Hal {grnPage}/{grnTotalPages}</span>
                            <button onClick={() => applyGrn(Math.min(grnTotalPages, grnPage + 1))} disabled={grnPage >= grnTotalPages} className="border-2 border-black px-3 py-1.5 text-[10px] font-black uppercase disabled:opacity-30 bg-white hover:bg-zinc-50 transition-colors">Next</button>
                        </div>
                    </div>
                </>
            )}

            {/* ═══ PAYROLL TAB ═══ */}
            {activeTab === "payroll" && (
                <>
                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                        <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
                            <div className="relative flex-1 max-w-xs">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                <Input placeholder="Cari periode payroll..." value={paySearch} onChange={e => setPaySearch(e.target.value)} className="pl-9 border-2 border-black font-bold h-10 placeholder:text-zinc-400 rounded-none" />
                            </div>
                            <select value={payStatus} onChange={e => setPayStatus(e.target.value)} className="border-2 border-black h-10 px-3 text-xs font-bold bg-white rounded-none">
                                <option value="">Semua Status</option>
                                <option value="DRAFT">Draft</option>
                                <option value="POSTED">Posted</option>
                                <option value="PAID">Paid</option>
                            </select>
                            <input type="date" value={payFrom} onChange={e => setPayFrom(e.target.value)} className="border-2 border-black h-10 px-3 text-xs font-bold bg-white rounded-none" />
                            <input type="date" value={payTo} onChange={e => setPayTo(e.target.value)} className="border-2 border-black h-10 px-3 text-xs font-bold bg-white rounded-none" />
                            <Button onClick={() => applyPay()} className="border-2 border-black bg-black text-white font-black uppercase text-[10px] tracking-widest h-10 rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all">
                                Terapkan
                            </Button>
                            <Button onClick={exportPayCsv} variant="outline" className="border-2 border-black font-black uppercase text-[10px] tracking-widest h-10 rounded-none ml-auto">
                                <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
                            </Button>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-zinc-50 dark:bg-zinc-800 border-b-2 border-black">
                                    <tr>
                                        <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Periode</th>
                                        <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</th>
                                        <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Update</th>
                                        <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {documents.payrollRuns.map(row => (
                                        <tr key={row.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                            <td className="p-4 font-bold text-xs text-zinc-900 dark:text-white">{row.periodLabel || row.period}</td>
                                            <td className="p-4">
                                                <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest border rounded-sm ${getStatusColor(row.status)}`}>{row.status}</span>
                                            </td>
                                            <td className="p-4 text-zinc-500 text-xs font-medium">{formatDateTime(row.updatedAt)}</td>
                                            <td className="p-4 text-right">
                                                <a href={row.viewUrl} target="_blank" rel="noreferrer">
                                                    <Button variant="outline" size="sm" className="border-2 border-black text-[10px] font-black uppercase tracking-widest h-7 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                                                        <ExternalLink className="h-3 w-3 mr-1" /> PDF
                                                    </Button>
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                    {documents.payrollRuns.length === 0 && (
                                        <tr><td colSpan={4} className="p-12 text-center">
                                            <Banknote className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Belum ada dokumen payroll</p>
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] px-4 py-3 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-500">Menampilkan {getRangeLabel(documentsMeta.payrollRuns.total, payPage, documentsMeta.payrollRuns.pageSize)} dari {documentsMeta.payrollRuns.total} dokumen</span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => applyPay(Math.max(1, payPage - 1))} disabled={payPage <= 1} className="border-2 border-black px-3 py-1.5 text-[10px] font-black uppercase disabled:opacity-30 bg-white hover:bg-zinc-50 transition-colors">Prev</button>
                            <span className="text-[10px] font-black px-2">Hal {payPage}/{payTotalPages}</span>
                            <button onClick={() => applyPay(Math.min(payTotalPages, payPage + 1))} disabled={payPage >= payTotalPages} className="border-2 border-black px-3 py-1.5 text-[10px] font-black uppercase disabled:opacity-30 bg-white hover:bg-zinc-50 transition-colors">Next</button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

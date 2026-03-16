"use client"

import { useMemo, useState } from "react"
import {
    BookText,
    Download,
    Lock,
    Plus,
    Search,
    Filter,
    RotateCcw,
    X,
    Eye,
    EyeOff,
    Hash,
    Calendar,
    Pencil,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { CheckboxFilter } from "@/components/ui/checkbox-filter"
import { NB } from "@/lib/dialog-styles"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { useJournal } from "@/hooks/use-journal"
import { ClosingJournalDialog } from "@/components/finance/closing-journal-dialog"
import { CreateJournalDialog } from "@/components/finance/journal/create-journal-dialog"

/* ─── Animation variants ─── */
const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.07 } },
}
const fadeUp = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 320, damping: 26 } },
}
const fadeX = {
    hidden: { opacity: 0, x: -12 },
    show: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 320, damping: 26 } },
}

export default function GeneralLedgerPage() {
    const { data, isLoading: loading } = useJournal()
    const entries = data?.entries ?? []
    const glAccounts = data?.accounts ?? []

    const [exportOpen, setExportOpen] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [closingOpen, setClosingOpen] = useState(false)
    const [editEntry, setEditEntry] = useState<typeof entries[number] | null>(null)
    const [searchText, setSearchText] = useState("")
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
    const [showAmounts, setShowAmounts] = useState(false)

    // ─── Filtering ───
    const filteredEntries = useMemo(() => {
        let result = entries
        if (searchText.trim()) {
            const q = searchText.toLowerCase()
            result = result.filter(
                (e) =>
                    e.description?.toLowerCase().includes(q) ||
                    e.reference?.toLowerCase().includes(q) ||
                    e.id.toLowerCase().includes(q) ||
                    e.lines.some(
                        (l) =>
                            l.account.name.toLowerCase().includes(q) ||
                            l.account.code.includes(q)
                    )
            )
        }
        if (selectedStatuses.length > 0) {
            result = result.filter((e) => selectedStatuses.includes(e.status))
        }
        return result
    }, [entries, searchText, selectedStatuses])

    // ─── KPI calculations ───
    const totalEntries = entries.length
    const draftCount = entries.filter((e) => e.status === "DRAFT").length
    const postedCount = entries.filter((e) => e.status === "POSTED").length
    const sumDebit = entries.reduce((sum, e) => sum + e.totalDebit, 0)
    const sumCredit = entries.reduce((sum, e) => sum + e.totalCredit, 0)
    const latestEntry =
        entries.length > 0
            ? new Date(entries[0].date).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
              })
            : "-"

    const resetFilters = () => {
        setSearchText("")
        setSelectedStatuses([])
    }

    const handleExport = () => {
        const header = [
            "Date",
            "Entry ID",
            "Reference",
            "Description",
            "Account Code",
            "Account Name",
            "Debit",
            "Credit",
        ]
        const rows: string[][] = []
        filteredEntries.forEach((entry) => {
            entry.lines.forEach((line) => {
                rows.push([
                    new Date(entry.date).toISOString(),
                    entry.id,
                    entry.reference || "",
                    entry.description || "",
                    line.account.code,
                    line.account.name,
                    String(line.debit || 0),
                    String(line.credit || 0),
                ])
            })
        })
        const csvContent = [header, ...rows]
            .map((r) =>
                r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")
            )
            .join("\n")
        const blob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;",
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `general-ledger-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success("Export CSV berhasil diunduh")
        setExportOpen(false)
    }

    return (
        <motion.div
            className="mf-page"
            variants={stagger}
            initial="hidden"
            animate="show"
        >
            {/* ─── Unified Page Header ─── */}
            <motion.div
                variants={fadeUp}
                className={NB.pageCard}
            >
                {/* Orange accent bar */}
                <div className={NB.pageAccent} />

                {/* Row 1: Title + Actions */}
                <div className={`px-5 py-3.5 flex items-center justify-between ${NB.pageRowBorder}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-orange-500 flex items-center justify-center">
                            <BookText className="h-4.5 w-4.5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                                Jurnal Umum
                            </h1>
                            <p className="text-zinc-400 text-[11px] font-medium">
                                Catatan kronologis seluruh transaksi keuangan
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-0">
                        <Button
                            onClick={() => setExportOpen(true)}
                            variant="outline"
                            className={`${NB.toolbarBtn} ${NB.toolbarBtnJoin}`}
                        >
                            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
                        </Button>
                        <Button
                            onClick={() => setClosingOpen(true)}
                            variant="outline"
                            className={NB.toolbarBtn}
                        >
                            <Lock className="h-3.5 w-3.5 mr-1.5" /> Jurnal Penutup
                        </Button>
                        <Button
                            onClick={() => setCreateOpen(true)}
                            className={NB.toolbarBtnPrimary}
                        >
                            <Plus className="h-3.5 w-3.5 mr-1.5" /> Buat Jurnal
                        </Button>
                    </div>
                </div>

                {/* Row 2: KPI Summary Strip */}
                <div className={`flex items-center divide-x divide-zinc-200 dark:divide-zinc-800 ${NB.pageRowBorder}`}>
                    {[
                        { label: "Semua", count: totalEntries, amount: sumDebit, color: "orange" },
                        { label: "Draft", count: draftCount, amount: null, color: "zinc" },
                        { label: "Posted", count: postedCount, amount: null, color: "emerald" },
                        { label: "Total Debit", count: null, amount: sumDebit, color: "blue" },
                        { label: "Total Kredit", count: null, amount: sumCredit, color: "red" },
                    ].map((kpi) => (
                        <div
                            key={kpi.label}
                            className="flex-1 px-4 py-3 flex items-center justify-between gap-3 cursor-default"
                        >
                            <div className="flex items-center gap-1.5">
                                <span
                                    className={`w-2 h-2 ${
                                        kpi.color === "orange"
                                            ? "bg-orange-500"
                                            : kpi.color === "zinc"
                                              ? "bg-zinc-400"
                                              : kpi.color === "emerald"
                                                ? "bg-emerald-500"
                                                : kpi.color === "blue"
                                                  ? "bg-blue-500"
                                                  : "bg-red-500"
                                    }`}
                                />
                                <span className={NB.kpiLabel}>{kpi.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {kpi.count !== null && (
                                    <motion.span
                                        key={kpi.count}
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ type: "spring" as const, stiffness: 400, damping: 20 }}
                                        className={NB.kpiCount}
                                    >
                                        {kpi.count}
                                    </motion.span>
                                )}
                                {kpi.amount !== null && kpi.amount > 0 && (
                                    <AnimatePresence>
                                        {(showAmounts || kpi.count === null) && (
                                            <motion.span
                                                initial={{ opacity: 0, x: -8 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -8 }}
                                                transition={{ type: "spring" as const, stiffness: 300, damping: 25 }}
                                                className={`text-xs font-mono font-bold ${
                                                    kpi.color === "red"
                                                        ? "text-red-600 dark:text-red-400"
                                                        : kpi.color === "blue"
                                                          ? "text-blue-600 dark:text-blue-400"
                                                          : "text-zinc-500 dark:text-zinc-400"
                                                }`}
                                            >
                                                {formatIDR(kpi.amount)}
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                )}
                                {kpi.count !== null && kpi.amount !== null && (
                                    <button
                                        onClick={() => setShowAmounts(!showAmounts)}
                                        className="p-0.5 text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
                                        title={showAmounts ? "Sembunyikan nominal" : "Tampilkan nominal"}
                                    >
                                        {showAmounts ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Row 3: Filter Toolbar */}
                <div className={NB.filterBar}>
                    <div className="flex items-center gap-0">
                        {/* Search input */}
                        <div className="relative">
                            <Search
                                className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 z-10 transition-colors ${
                                    searchText ? NB.inputIconActive : NB.inputIconEmpty
                                }`}
                            />
                            <input
                                className={`border border-r-0 font-medium h-9 w-[320px] text-xs rounded-none pl-9 pr-8 outline-none placeholder:text-zinc-400 transition-all ${
                                    searchText ? NB.inputActive : NB.inputEmpty
                                }`}
                                placeholder="Cari deskripsi, referensi, akun..."
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                            />
                            {searchText && (
                                <button
                                    onClick={() => setSearchText("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-colors z-10"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                        {/* Status filter */}
                        <CheckboxFilter
                            label="Status"
                            hideLabel
                            triggerClassName={NB.filterDropdown}
                            triggerActiveClassName="flex items-center gap-2 border border-orange-400 dark:border-orange-500 border-r-0 h-9 px-3 bg-orange-50/50 dark:bg-orange-950/20 text-xs font-medium min-w-[120px] justify-between transition-all rounded-none"
                            options={[
                                { value: "DRAFT", label: "Draft" },
                                { value: "POSTED", label: "Posted" },
                                { value: "VOID", label: "Void" },
                            ]}
                            selected={selectedStatuses}
                            onChange={setSelectedStatuses}
                        />
                        {/* Terapkan */}
                        <Button
                            variant="outline"
                            className={NB.toolbarBtn}
                        >
                            <Filter className="h-3.5 w-3.5 mr-1.5" /> Terapkan
                        </Button>
                        {/* Reset */}
                        {(selectedStatuses.length > 0 || searchText) && (
                            <Button
                                variant="ghost"
                                onClick={resetFilters}
                                className="text-zinc-400 text-[10px] font-bold uppercase h-9 px-3 rounded-none hover:text-zinc-700 dark:hover:text-zinc-200 ml-1.5"
                            >
                                <RotateCcw className="h-3 w-3 mr-1" /> Reset
                            </Button>
                        )}
                    </div>
                    <span className="hidden md:inline text-[11px] font-medium text-zinc-400">
                        <span className="font-mono font-bold text-zinc-600 dark:text-zinc-300">
                            {filteredEntries.length}
                        </span>{" "}
                        jurnal
                    </span>
                </div>
            </motion.div>

            {/* ─── Export Dialog ─── */}
            <Dialog open={exportOpen} onOpenChange={setExportOpen}>
                <DialogContent className={NB.contentNarrow}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}>
                            <Download className="h-5 w-5" /> Export General Ledger
                        </DialogTitle>
                        <p className={NB.subtitle}>
                            Download semua baris jurnal yang sedang tampil sebagai CSV
                        </p>
                    </DialogHeader>
                    <div className="px-6 py-5 space-y-4">
                        <div>
                            <label className={NB.label}>Format</label>
                            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                CSV (Comma-Separated Values)
                            </p>
                        </div>
                        <div>
                            <label className={NB.label}>Data</label>
                            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                {filteredEntries.length} entri jurnal
                            </p>
                        </div>
                        <div className={NB.footer}>
                            <Button
                                variant="outline"
                                className={NB.cancelBtn}
                                onClick={() => setExportOpen(false)}
                            >
                                Batal
                            </Button>
                            <Button className={NB.submitBtn} onClick={handleExport}>
                                <Download className="mr-2 h-3.5 w-3.5" /> Download CSV
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ─── Create / Edit Journal Dialog ─── */}
            <CreateJournalDialog
                open={createOpen || !!editEntry}
                onOpenChange={(v) => {
                    if (!v) { setCreateOpen(false); setEditEntry(null) }
                    else setCreateOpen(v)
                }}
                glAccounts={glAccounts}
                editEntry={editEntry}
            />

            {/* ─── Journal Entries Table ─── */}
            <motion.div
                variants={fadeUp}
                className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden flex flex-col"
                style={{ minHeight: 420 }}
            >
                {/* Table Header — black bar */}
                <div className="hidden md:grid grid-cols-[80px_1fr_140px_100px] gap-2 px-5 py-2.5 bg-black dark:bg-zinc-950 border-b-2 border-black">
                    {["Tanggal", "Deskripsi & Akun", "Jumlah", "Status"].map((h) => (
                        <span
                            key={h}
                            className="text-[10px] font-black uppercase tracking-widest text-zinc-400"
                        >
                            {h}
                        </span>
                    ))}
                </div>

                {/* Table Body */}
                <div className="w-full flex-1 flex flex-col">
                    {loading && filteredEntries.length === 0 ? (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="grid grid-cols-[80px_1fr_140px_100px] gap-2 px-5 py-4 items-center animate-pulse"
                                >
                                    <div className="h-10 w-14 bg-zinc-200 dark:bg-zinc-700 rounded-sm" />
                                    <div className="space-y-2">
                                        <div className="h-3 w-32 bg-zinc-200 dark:bg-zinc-700 rounded-sm" />
                                        <div className="h-3 w-48 bg-zinc-100 dark:bg-zinc-800 rounded-sm" />
                                    </div>
                                    <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-700 rounded-sm" />
                                    <div className="h-5 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-sm" />
                                </div>
                            ))}
                        </div>
                    ) : filteredEntries.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: "spring" as const, stiffness: 300, damping: 25 }}
                            className="flex-1 flex flex-col items-center justify-center py-16 text-zinc-400"
                        >
                            <div className="w-16 h-16 border-2 border-zinc-200 dark:border-zinc-700 flex items-center justify-center mb-4">
                                <BookText className="h-7 w-7 text-zinc-200 dark:text-zinc-700" />
                            </div>
                            <span className="text-sm font-bold">Belum ada jurnal</span>
                            <span className="text-xs text-zinc-400 mt-1">
                                Buat jurnal baru atau ubah filter pencarian
                            </span>
                        </motion.div>
                    ) : (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {filteredEntries.map((entry, idx) => {
                                const isDraft = entry.status === "DRAFT"
                                return (
                                    <motion.div
                                        key={entry.id}
                                        custom={idx}
                                        variants={fadeX}
                                        initial="hidden"
                                        animate="show"
                                        transition={{ delay: idx * 0.03 }}
                                        className={`group/row transition-all border-l-[3px] ${
                                            isDraft
                                                ? "border-l-amber-400 hover:bg-amber-50/40 dark:hover:bg-amber-950/10"
                                                : entry.status === "VOID"
                                                    ? "border-l-red-300 hover:bg-red-50/30 dark:hover:bg-red-950/10"
                                                    : "border-l-transparent hover:bg-orange-50/50 dark:hover:bg-orange-950/10"
                                        } ${
                                            idx % 2 === 0
                                                ? "bg-white dark:bg-zinc-900"
                                                : "bg-zinc-50/60 dark:bg-zinc-800/20"
                                        } ${isDraft ? "cursor-pointer" : ""}`}
                                        onClick={isDraft ? () => setEditEntry(entry) : undefined}
                                    >
                                        {/* Entry Header Row */}
                                        <div className="grid grid-cols-1 md:grid-cols-[80px_1fr_140px_100px] gap-2 px-5 py-3 items-center">
                                            {/* Date block */}
                                            <div className={`w-16 text-center border border-zinc-200 dark:border-zinc-700 py-1.5 ${
                                                isDraft ? "bg-amber-50 dark:bg-amber-950/20" : "bg-zinc-50 dark:bg-zinc-800/50"
                                            }`}>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                                    {new Date(entry.date).toLocaleString("id-ID", {
                                                        month: "short",
                                                    })}
                                                </p>
                                                <p className="text-xl font-black text-zinc-900 dark:text-white leading-none">
                                                    {new Date(entry.date).getDate()}
                                                </p>
                                            </div>

                                            {/* Description + tags */}
                                            <div>
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 border border-zinc-200 dark:border-zinc-700 text-zinc-400 bg-zinc-50 dark:bg-zinc-800 font-mono">
                                                        JE-{entry.id.substring(0, 8)}
                                                    </span>
                                                    {entry.reference && (
                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-mono">
                                                            {entry.reference}
                                                        </span>
                                                    )}
                                                    {isDraft && (
                                                        <span className="text-[9px] font-bold text-amber-500 dark:text-amber-400 opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center gap-1">
                                                            <Pencil className="h-2.5 w-2.5" /> Klik untuk edit
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="font-bold text-sm text-zinc-900 dark:text-white">
                                                    {entry.description}
                                                </p>
                                            </div>

                                            {/* Amount */}
                                            <div className="text-right">
                                                <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                                                    {formatIDR(entry.totalDebit)}
                                                </span>
                                            </div>

                                            {/* Status */}
                                            <div className="flex items-center justify-between">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide px-2 py-1 border rounded-none ${
                                                        entry.status === "POSTED"
                                                            ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400"
                                                            : entry.status === "VOID"
                                                              ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400"
                                                              : "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400"
                                                    }`}
                                                >
                                                    <span
                                                        className={`w-1.5 h-1.5 ${
                                                            entry.status === "POSTED"
                                                                ? "bg-emerald-500"
                                                                : entry.status === "VOID"
                                                                  ? "bg-red-500"
                                                                  : "bg-amber-500"
                                                        }`}
                                                    />
                                                    {entry.status}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Line Items Table */}
                                        <div className="mx-5 mb-3 border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/50 overflow-hidden">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-100/80 dark:bg-zinc-800/80">
                                                        <th className="text-left py-1.5 px-3 w-1/2">
                                                            Akun
                                                        </th>
                                                        <th className="text-right py-1.5 px-3">Debit</th>
                                                        <th className="text-right py-1.5 px-3">
                                                            Kredit
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="font-mono">
                                                    {entry.lines.map((item, lineIdx) => (
                                                        <tr
                                                            key={lineIdx}
                                                            className="border-b border-zinc-100 dark:border-zinc-700 last:border-b-0"
                                                        >
                                                            <td className="py-1.5 px-3 font-sans font-medium text-zinc-700 dark:text-zinc-300">
                                                                <span className="text-zinc-400 font-mono text-[10px] mr-1.5">{item.account.code}</span>
                                                                {item.account.name}
                                                            </td>
                                                            <td className={`py-1.5 px-3 text-right font-bold tabular-nums ${item.debit > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-300 dark:text-zinc-600"}`}>
                                                                {item.debit > 0
                                                                    ? formatIDR(item.debit)
                                                                    : "-"}
                                                            </td>
                                                            <td className={`py-1.5 px-3 text-right font-bold tabular-nums ${item.credit > 0 ? "text-red-700 dark:text-red-400" : "text-zinc-300 dark:text-zinc-600"}`}>
                                                                {item.credit > 0
                                                                    ? formatIDR(item.credit)
                                                                    : "-"}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        {filteredEntries.length} jurnal ditampilkan
                    </span>
                    <span className="text-[10px] font-medium text-zinc-400">
                        Entri terakhir:{" "}
                        <span className="font-bold text-zinc-600 dark:text-zinc-300">
                            {latestEntry}
                        </span>
                    </span>
                </div>
            </motion.div>

            {/* Closing Journal Dialog */}
            <ClosingJournalDialog open={closingOpen} onOpenChange={setClosingOpen} />
        </motion.div>
    )
}

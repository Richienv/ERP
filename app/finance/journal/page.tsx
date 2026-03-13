"use client"

import { useState } from "react"
import {
    Plus,
    Download,
    BookText,
    Hash,
    Calendar,
    Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { NB } from "@/lib/dialog-styles"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { useJournal } from "@/hooks/use-journal"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { ClosingJournalDialog } from "@/components/finance/closing-journal-dialog"
import { CreateJournalDialog } from "@/components/finance/journal/create-journal-dialog"

export default function GeneralLedgerPage() {
    const { data, isLoading: loading } = useJournal()
    const entries = data?.entries ?? []
    const glAccounts = data?.accounts ?? []
    const [exportOpen, setExportOpen] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [closingOpen, setClosingOpen] = useState(false)

    const handleExport = () => {
        const header = ["Date", "Entry ID", "Reference", "Description", "Account Code", "Account Name", "Debit", "Credit"]
        const rows: string[][] = []
        entries.forEach((entry) => {
            entry.lines.forEach((line) => {
                rows.push([
                    new Date(entry.date).toISOString(), entry.id, entry.reference || "",
                    entry.description || "", line.account.code, line.account.name,
                    String(line.debit || 0), String(line.credit || 0),
                ])
            })
        })
        const csvContent = [header, ...rows].map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n")
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `general-ledger-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success("Export CSV berhasil diunduh")
        setExportOpen(false)
    }

    // KPI calculations
    const totalEntries = entries.length
    const sumDebit = entries.reduce((sum, e) => sum + e.totalDebit, 0)
    const sumCredit = entries.reduce((sum, e) => sum + e.totalCredit, 0)
    const latestEntry = entries.length > 0 ? new Date(entries[0].date).toLocaleDateString("id-ID") : "-"

    return (
        <div className="mf-page">

            {/* ═══ COMMAND HEADER ═══ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-purple-400">
                    <div className="flex items-center gap-3">
                        <BookText className="h-5 w-5 text-purple-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Jurnal Umum
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Catatan kronologis seluruh transaksi keuangan
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Dialog open={exportOpen} onOpenChange={setExportOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="border-2 border-black text-[10px] font-black uppercase tracking-widest h-9 px-4 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none">
                                    <Download className="mr-2 h-3.5 w-3.5" /> Export
                                </Button>
                            </DialogTrigger>
                            <DialogContent className={NB.contentNarrow}>
                                <DialogHeader className={NB.header}>
                                    <DialogTitle className={NB.title}>
                                        <Download className="h-5 w-5" /> Export General Ledger
                                    </DialogTitle>
                                    <p className={NB.subtitle}>Download semua baris jurnal yang sedang tampil sebagai CSV</p>
                                </DialogHeader>
                                <div className="px-6 py-5 space-y-4">
                                    <div>
                                        <label className={NB.label}>Format</label>
                                        <p className="text-sm font-bold text-zinc-700">CSV (Comma-Separated Values)</p>
                                    </div>
                                    <div>
                                        <label className={NB.label}>Data</label>
                                        <p className="text-sm font-bold text-zinc-700">{entries.length} entri jurnal</p>
                                    </div>
                                    <div className={NB.footer}>
                                        <Button variant="outline" className={NB.cancelBtn} onClick={() => setExportOpen(false)}>
                                            Batal
                                        </Button>
                                        <Button className={NB.submitBtn} onClick={handleExport}>
                                            <Download className="mr-2 h-3.5 w-3.5" /> Download CSV
                                        </Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                        <Button
                            onClick={() => setClosingOpen(true)}
                            variant="outline"
                            className="border-2 border-black text-[10px] font-black uppercase tracking-widest h-9 px-4 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
                        >
                            <Lock className="mr-2 h-3.5 w-3.5" /> Jurnal Penutup
                        </Button>
                        <Button
                            onClick={() => setCreateOpen(true)}
                            className="bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all text-[10px] font-black uppercase tracking-widest h-9 px-4"
                        >
                            <Plus className="mr-2 h-3.5 w-3.5" /> Buat Jurnal
                        </Button>
                    </div>
                </div>
            </div>

            {/* ═══ KPI PULSE STRIP ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-purple-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Hash className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Entri</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">{totalEntries}</div>
                        <div className="text-[10px] font-bold text-purple-600 mt-1">Journal entries</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-black text-zinc-400">D</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Debit</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-emerald-600">{formatIDR(sumDebit)}</div>
                        <div className="text-[10px] font-bold text-emerald-600 mt-1">Akumulasi debit</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-red-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-black text-zinc-400">C</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Credit</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-red-600">{formatIDR(sumCredit)}</div>
                        <div className="text-[10px] font-bold text-red-600 mt-1">Akumulasi kredit</div>
                    </div>
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Calendar className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Entri Terakhir</span>
                        </div>
                        <div className="text-xl md:text-2xl font-black tracking-tighter text-blue-600">{latestEntry}</div>
                        <div className="text-[10px] font-bold text-blue-600 mt-1">Tanggal terbaru</div>
                    </div>
                </div>
            </div>

            {/* ═══ CREATE JOURNAL DIALOG ═══ */}
            <CreateJournalDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                glAccounts={glAccounts}
            />

            {/* ═══ JOURNAL ENTRIES TABLE ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="px-4 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                        <BookText className="h-3.5 w-3.5" /> Daftar Jurnal
                    </p>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{entries.length} entries</span>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-[10px] font-black uppercase tracking-widest text-zinc-400 animate-pulse">
                        Memuat data jurnal...
                    </div>
                ) : entries.length === 0 ? (
                    <div className="p-12 text-center">
                        <BookText className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Belum ada jurnal</p>
                    </div>
                ) : (
                    entries.map((entry) => (
                        <div key={entry.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                            {/* Entry Header */}
                            <div className="px-4 py-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-16 text-center">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                            {new Date(entry.date).toLocaleString("default", { month: "short" })}
                                        </p>
                                        <p className="text-xl font-black">{new Date(entry.date).getDate()}</p>
                                    </div>
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
                                        </div>
                                        <p className="font-bold text-sm uppercase">{entry.description}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-mono font-bold text-sm text-emerald-600">{formatIDR(entry.totalDebit)}</p>
                                </div>
                            </div>

                            {/* Line Items */}
                            <div className="mx-4 mb-3 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
                                            <th className="text-left py-1.5 px-3 w-1/2">Akun</th>
                                            <th className="text-right py-1.5 px-3">Debit</th>
                                            <th className="text-right py-1.5 px-3">Credit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="font-mono">
                                        {entry.lines.map((item, idx) => (
                                            <tr key={idx} className="border-b border-zinc-100 dark:border-zinc-700 last:border-b-0">
                                                <td className="py-1.5 px-3 font-sans font-medium text-zinc-700 dark:text-zinc-300">
                                                    {item.account.code} - {item.account.name}
                                                </td>
                                                <td className="py-1.5 px-3 text-right text-emerald-700">{item.debit > 0 ? formatIDR(item.debit) : '-'}</td>
                                                <td className="py-1.5 px-3 text-right text-red-700">{item.credit > 0 ? formatIDR(item.credit) : '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Closing Journal Dialog */}
            <ClosingJournalDialog open={closingOpen} onOpenChange={setClosingOpen} />
        </div>
    )
}

"use client"

import { useState } from "react"
import {
    Plus,
    Download,
    Save,
    Trash2,
    CheckCircle2,
    AlertCircle,
    BookText,
    Hash,
    ChevronDown,
    ChevronUp,
    Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { postJournalEntry, type JournalEntryItem } from "@/lib/actions/finance"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { useJournal } from "@/hooks/use-journal"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export default function GeneralLedgerPage() {
    const { data, isLoading: loading } = useJournal()
    const queryClient = useQueryClient()
    const entries = data?.entries ?? []
    const glAccounts = data?.accounts ?? []
    const [lines, setLines] = useState([
        { accountId: "", debit: 0, credit: 0 },
        { accountId: "", debit: 0, credit: 0 }
    ])
    const [desc, setDesc] = useState("")
    const [ref, setRef] = useState("")
    const [posting, setPosting] = useState(false)
    const [exportOpen, setExportOpen] = useState(false)
    const [showForm, setShowForm] = useState(false)

    const totalDebit = lines.reduce((acc, curr) => acc + (Number(curr.debit) || 0), 0)
    const totalCredit = lines.reduce((acc, curr) => acc + (Number(curr.credit) || 0), 0)
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0

    const handleAddLine = () => setLines([...lines, { accountId: "", debit: 0, credit: 0 }])

    const handleSave = async () => {
        if (!isBalanced || !desc.trim()) return
        setPosting(true)
        try {
            const validLines = lines.filter((line) => (Number(line.debit) > 0 || Number(line.credit) > 0))
            if (validLines.length < 2) { toast.error("Minimal dua baris akun dengan nominal"); return }

            const hasInvalidLine = validLines.some((line) => {
                const debit = Number(line.debit) || 0
                const credit = Number(line.credit) || 0
                return !line.accountId || (debit > 0 && credit > 0) || (debit <= 0 && credit <= 0)
            })
            if (hasInvalidLine) { toast.error("Setiap baris harus punya akun, dan hanya debit atau kredit yang bernilai"); return }

            const entryLines = validLines.map(line => {
                const acc = glAccounts.find(a => a.id === line.accountId)
                if (!acc) throw new Error("Account mapping not found")
                return { accountCode: acc.code, debit: line.debit, credit: line.credit, description: desc.trim() }
            })

            const result = await postJournalEntry({ date: new Date(), description: desc, reference: ref, lines: entryLines })
            if (result.success) {
                toast.success("Jurnal berhasil diposting")
                setLines([{ accountId: "", debit: 0, credit: 0 }, { accountId: "", debit: 0, credit: 0 }])
                setDesc("")
                setRef("")
                setShowForm(false)
                queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all })
            } else {
                toast.error(('error' in result ? result.error : "Gagal posting entry") || "Gagal posting entry")
            }
        } catch {
            toast.error("Terjadi kesalahan saat posting")
        } finally {
            setPosting(false)
        }
    }

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
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Export General Ledger</DialogTitle>
                                    <DialogDescription>Download semua baris jurnal yang sedang tampil sebagai CSV.</DialogDescription>
                                </DialogHeader>
                                <Button onClick={handleExport} className="w-full">Download CSV</Button>
                            </DialogContent>
                        </Dialog>
                        <Button
                            onClick={() => setShowForm(!showForm)}
                            className="bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all text-[10px] font-black uppercase tracking-widest h-9 px-4"
                        >
                            {showForm ? <><ChevronUp className="mr-2 h-3.5 w-3.5" /> Tutup</> : <><Plus className="mr-2 h-3.5 w-3.5" /> Buat Jurnal</>}
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

            {/* ═══ ENTRY FORM (Collapsible) ═══ */}
            {showForm && (
                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="px-4 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                            <Plus className="h-3.5 w-3.5" /> Buat Jurnal Baru
                        </p>
                    </div>
                    <div className="p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Deskripsi</label>
                                <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Contoh: Manual Adjustment" className="border-2 border-black font-bold h-10 rounded-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Referensi</label>
                                <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Contoh: REF-001" className="border-2 border-black font-bold h-10 rounded-none" />
                            </div>
                        </div>

                        {/* Line Items */}
                        <div className="border-2 border-black overflow-hidden">
                            <div className="grid grid-cols-12 gap-2 px-3 py-2 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                <div className="col-span-6">Akun</div>
                                <div className="col-span-2 text-right">Debit</div>
                                <div className="col-span-2 text-right">Credit</div>
                                <div className="col-span-2"></div>
                            </div>
                            {lines.map((line, i) => (
                                <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 items-center">
                                    <div className="col-span-6">
                                        <Select value={line.accountId} onValueChange={(v) => {
                                            const newLines = [...lines]; newLines[i].accountId = v; setLines(newLines)
                                        }}>
                                            <SelectTrigger className="h-9 border-zinc-200 bg-white dark:bg-zinc-900 text-xs font-medium rounded-none">
                                                <SelectValue placeholder="Pilih Akun" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {glAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-2">
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            className="h-9 border-zinc-200 bg-emerald-50/50 text-right text-xs font-mono rounded-none"
                                            value={line.debit || ''}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0
                                                const newLines = [...lines]; newLines[i].debit = val
                                                if (val > 0) newLines[i].credit = 0; setLines(newLines)
                                            }}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            className="h-9 border-zinc-200 bg-red-50/50 text-right text-xs font-mono rounded-none"
                                            value={line.credit || ''}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0
                                                const newLines = [...lines]; newLines[i].credit = val
                                                if (val > 0) newLines[i].debit = 0; setLines(newLines)
                                            }}
                                        />
                                    </div>
                                    <div className="col-span-2 flex justify-center">
                                        <button
                                            onClick={() => { if (lines.length > 2) setLines(lines.filter((_, idx) => idx !== i)) }}
                                            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
                                <button onClick={handleAddLine} className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-black border-2 border-dashed border-zinc-300 hover:border-black transition-colors flex items-center justify-center gap-2">
                                    <Plus className="h-3 w-3" /> Tambah Baris
                                </button>
                            </div>

                            {/* Totals Footer */}
                            <div className="px-3 py-3 bg-zinc-50 dark:bg-zinc-800 space-y-3">
                                <div className="grid grid-cols-12 gap-2 text-xs font-bold uppercase">
                                    <div className="col-span-6 text-right text-zinc-500">Total</div>
                                    <div className="col-span-2 text-right font-mono text-emerald-700">{formatIDR(totalDebit)}</div>
                                    <div className="col-span-2 text-right font-mono text-red-700">{formatIDR(totalCredit)}</div>
                                    <div className="col-span-2"></div>
                                </div>
                                <div className={`flex items-center justify-center p-2 text-[10px] font-black uppercase tracking-widest border ${isBalanced ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-red-100 text-red-800 border-red-300'}`}>
                                    {isBalanced ? (
                                        <><CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Balanced</>
                                    ) : (
                                        <><AlertCircle className="mr-2 h-3.5 w-3.5" /> Unbalanced ({formatIDR(Math.abs(totalDebit - totalCredit))})</>
                                    )}
                                </div>
                                <Button
                                    className="w-full bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all text-[10px] font-black uppercase tracking-widest h-10 disabled:opacity-40"
                                    disabled={!isBalanced || !desc || posting}
                                    onClick={handleSave}
                                >
                                    {posting ? "Posting..." : <><Save className="mr-2 h-3.5 w-3.5" /> Post Entry</>}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
        </div>
    )
}

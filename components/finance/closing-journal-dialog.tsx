"use client"

import { useState, useCallback } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Lock, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { formatIDR } from "@/lib/utils"
import { NB } from "@/lib/dialog-styles"
import {
    previewClosingJournal,
    postClosingJournal,
    type ClosingJournalPreview,
} from "@/lib/actions/finance-gl"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

interface ClosingJournalDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ClosingJournalDialog({ open, onOpenChange }: ClosingJournalDialogProps) {
    const queryClient = useQueryClient()
    const currentYear = new Date().getFullYear()
    const [selectedYear, setSelectedYear] = useState<string>(String(currentYear - 1))
    const [preview, setPreview] = useState<ClosingJournalPreview | null>(null)
    const [loading, setLoading] = useState(false)
    const [posting, setPosting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Generate year options (last 5 years)
    const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 1 - i)

    const handlePreview = useCallback(async () => {
        setLoading(true)
        setError(null)
        setPreview(null)

        const result = await previewClosingJournal(Number(selectedYear))
        if (result.success && result.data) {
            setPreview(result.data)
            if (result.data.alreadyClosed) {
                setError(`Tahun fiskal ${selectedYear} sudah ditutup sebelumnya.`)
            }
        } else {
            setError(result.error || "Gagal memuat preview")
        }

        setLoading(false)
    }, [selectedYear])

    const handlePost = useCallback(async () => {
        if (!preview || preview.alreadyClosed) return

        setPosting(true)
        const result = await postClosingJournal(Number(selectedYear))

        if (result.success) {
            toast.success(`Jurnal penutup tahun ${selectedYear} berhasil diposting`)
            // Invalidate all related queries
            queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.glAccounts.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all })
            onOpenChange(false)
            setPreview(null)
        } else {
            toast.error(result.error || "Gagal memposting jurnal penutup")
        }

        setPosting(false)
    }, [preview, selectedYear, queryClient, onOpenChange])

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setPreview(null)
            setError(null)
        }
        onOpenChange(open)
    }

    const revenueLines = preview?.lines.filter(l => l.accountType === "REVENUE") ?? []
    const expenseLines = preview?.lines.filter(l => l.accountType === "EXPENSE") ?? []
    const equityLines = preview?.lines.filter(l => l.accountType === "EQUITY") ?? []

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className={NB.contentWide}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <Lock className="h-5 w-5" /> Jurnal Penutup
                    </DialogTitle>
                    <DialogDescription className={NB.subtitle}>
                        Tutup akun pendapatan & beban, transfer laba bersih ke Laba Ditahan
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-5">
                    {/* Year Selection */}
                    <div className={NB.section}>
                        <div className={NB.sectionHead}>
                            <span className={NB.sectionTitle}>Pilih Tahun Fiskal</span>
                        </div>
                        <div className={`${NB.sectionBody} flex items-end gap-3`}>
                            <div className="flex-1">
                                <label className={NB.label}>Tahun</label>
                                <Select value={selectedYear} onValueChange={setSelectedYear}>
                                    <SelectTrigger className={NB.select}>
                                        <SelectValue placeholder="Pilih tahun..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {yearOptions.map(year => (
                                            <SelectItem key={year} value={String(year)}>
                                                {year}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button
                                onClick={handlePreview}
                                disabled={loading}
                                className={NB.submitBtn}
                            >
                                {loading ? (
                                    <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Memuat...</>
                                ) : (
                                    "Preview"
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-2 p-3 border-2 border-amber-400 bg-amber-50 text-amber-800 text-sm font-bold">
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Preview Results */}
                    {preview && !preview.alreadyClosed && preview.lines.length > 0 && (
                        <>
                            {/* Summary KPIs */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="border-2 border-black p-3 bg-emerald-50">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">
                                        Total Pendapatan
                                    </div>
                                    <div className="text-lg font-black text-emerald-700 font-mono">
                                        {formatIDR(preview.revenueTotal)}
                                    </div>
                                </div>
                                <div className="border-2 border-black p-3 bg-red-50">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">
                                        Total Beban
                                    </div>
                                    <div className="text-lg font-black text-red-700 font-mono">
                                        {formatIDR(preview.expenseTotal)}
                                    </div>
                                </div>
                                <div className={`border-2 border-black p-3 ${preview.netIncome >= 0 ? "bg-blue-50" : "bg-amber-50"}`}>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">
                                        {preview.netIncome >= 0 ? "Laba Bersih" : "Rugi Bersih"}
                                    </div>
                                    <div className={`text-lg font-black font-mono ${preview.netIncome >= 0 ? "text-blue-700" : "text-amber-700"}`}>
                                        {formatIDR(Math.abs(preview.netIncome))}
                                    </div>
                                </div>
                            </div>

                            {/* Retained Earnings info */}
                            {preview.retainedEarningsAccount ? (
                                <div className="flex items-center gap-2 p-2 border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-600">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                    Transfer ke: <span className="font-mono font-bold">{preview.retainedEarningsAccount.code}</span> - {preview.retainedEarningsAccount.name}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 p-2 border-2 border-red-300 bg-red-50 text-xs font-bold text-red-700">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    Akun Laba Ditahan tidak ditemukan. Buat akun ekuitas terlebih dahulu.
                                </div>
                            )}

                            {/* Detail Lines */}
                            <div className={NB.section}>
                                <div className={NB.sectionHead}>
                                    <span className={NB.sectionTitle}>Preview Jurnal Penutup</span>
                                    <Badge variant="outline" className="text-[10px] font-black ml-auto">
                                        CLOSING-{selectedYear}
                                    </Badge>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-zinc-100 border-b-2 border-black text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                                <th className="text-left px-3 py-2">Akun</th>
                                                <th className="text-right px-3 py-2">Debit</th>
                                                <th className="text-right px-3 py-2">Kredit</th>
                                            </tr>
                                        </thead>
                                        <tbody className="font-mono">
                                            {/* Revenue closing lines */}
                                            {revenueLines.length > 0 && (
                                                <tr className="border-b border-zinc-200 bg-emerald-50/50">
                                                    <td colSpan={3} className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                                        Penutupan Pendapatan
                                                    </td>
                                                </tr>
                                            )}
                                            {revenueLines.map((line, idx) => (
                                                <tr key={`rev-${idx}`} className="border-b border-zinc-100">
                                                    <td className="px-3 py-1.5 font-sans font-medium text-zinc-700">
                                                        {line.accountCode} - {line.accountName}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right text-emerald-700">
                                                        {line.debit > 0 ? formatIDR(line.debit) : "-"}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right text-red-700">
                                                        {line.credit > 0 ? formatIDR(line.credit) : "-"}
                                                    </td>
                                                </tr>
                                            ))}

                                            {/* Expense closing lines */}
                                            {expenseLines.length > 0 && (
                                                <tr className="border-b border-zinc-200 bg-red-50/50">
                                                    <td colSpan={3} className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-700">
                                                        Penutupan Beban
                                                    </td>
                                                </tr>
                                            )}
                                            {expenseLines.map((line, idx) => (
                                                <tr key={`exp-${idx}`} className="border-b border-zinc-100">
                                                    <td className="px-3 py-1.5 font-sans font-medium text-zinc-700">
                                                        {line.accountCode} - {line.accountName}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right text-emerald-700">
                                                        {line.debit > 0 ? formatIDR(line.debit) : "-"}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right text-red-700">
                                                        {line.credit > 0 ? formatIDR(line.credit) : "-"}
                                                    </td>
                                                </tr>
                                            ))}

                                            {/* Equity transfer line */}
                                            {equityLines.length > 0 && (
                                                <tr className="border-b border-zinc-200 bg-blue-50/50">
                                                    <td colSpan={3} className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-blue-700">
                                                        Transfer Laba Ditahan
                                                    </td>
                                                </tr>
                                            )}
                                            {equityLines.map((line, idx) => (
                                                <tr key={`eq-${idx}`} className="border-b border-zinc-100">
                                                    <td className="px-3 py-1.5 font-sans font-medium text-zinc-700">
                                                        {line.accountCode} - {line.accountName}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right text-emerald-700">
                                                        {line.debit > 0 ? formatIDR(line.debit) : "-"}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right text-red-700">
                                                        {line.credit > 0 ? formatIDR(line.credit) : "-"}
                                                    </td>
                                                </tr>
                                            ))}

                                            {/* Totals */}
                                            <tr className="bg-zinc-100 border-t-2 border-black font-bold">
                                                <td className="px-3 py-2 font-sans text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                                    Total
                                                </td>
                                                <td className="px-3 py-2 text-right text-emerald-700">
                                                    {formatIDR(preview.lines.reduce((s, l) => s + l.debit, 0))}
                                                </td>
                                                <td className="px-3 py-2 text-right text-red-700">
                                                    {formatIDR(preview.lines.reduce((s, l) => s + l.credit, 0))}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className={NB.footer}>
                                <Button
                                    variant="outline"
                                    onClick={() => handleOpenChange(false)}
                                    className={NB.cancelBtn}
                                >
                                    Batal
                                </Button>
                                <Button
                                    onClick={handlePost}
                                    disabled={posting || !preview.retainedEarningsAccount}
                                    className={NB.submitBtn}
                                >
                                    {posting ? (
                                        <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Memposting...</>
                                    ) : (
                                        <><Lock className="mr-2 h-3.5 w-3.5" /> Posting Jurnal Penutup</>
                                    )}
                                </Button>
                            </div>
                        </>
                    )}

                    {/* No balances to close */}
                    {preview && !preview.alreadyClosed && preview.lines.length === 0 && (
                        <div className="text-center py-8">
                            <CheckCircle2 className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                            <p className="text-sm font-bold text-zinc-500">
                                Tidak ada saldo pendapatan atau beban untuk ditutup pada tahun {selectedYear}.
                            </p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

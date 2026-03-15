"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { useDepreciationRuns } from "@/hooks/use-fixed-assets"
import { previewDepreciationRun, postDepreciationRun, reverseDepreciationRun } from "@/lib/actions/finance-fixed-assets"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { NB } from "@/lib/dialog-styles"
import { toast } from "sonner"
import Link from "next/link"
import { Calculator, Play, ArrowLeft, RefreshCcw, Undo2, Loader2, AlertTriangle, CheckCircle } from "lucide-react"

export const dynamic = "force-dynamic"

const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val)

const statusConfig: Record<string, { label: string; color: string }> = {
    POSTED: { label: "Diposting", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
    REVERSED: { label: "Dibatalkan", color: "bg-red-100 text-red-700 border-red-300" },
    PREVIEW: { label: "Pratinjau", color: "bg-amber-100 text-amber-700 border-amber-300" },
}

export default function DepreciationRunPage() {
    const queryClient = useQueryClient()
    const { data, isLoading } = useDepreciationRuns()

    // Run depreciation state
    const [periodStart, setPeriodStart] = useState("")
    const [periodEnd, setPeriodEnd] = useState("")
    const [previewing, setPreviewing] = useState(false)
    const [posting, setPosting] = useState(false)
    const [reversingId, setReversingId] = useState<string | null>(null)
    const [previewData, setPreviewData] = useState<any[] | null>(null)
    const [hasPreview, setHasPreview] = useState(false)

    if (isLoading) return <TablePageSkeleton accentColor="bg-purple-400" />

    const runs = data?.runs || []

    const handlePreview = async () => {
        if (!periodStart || !periodEnd) {
            toast.error("Pilih periode awal dan akhir terlebih dahulu")
            return
        }
        if (periodStart > periodEnd) {
            toast.error("Periode awal tidak boleh lebih besar dari periode akhir")
            return
        }
        setPreviewing(true)
        setPreviewData(null)
        setHasPreview(false)
        try {
            const result = await previewDepreciationRun(periodStart, periodEnd)
            if (result?.success) {
                setPreviewData(result.entries || [])
                setHasPreview(true)
                toast.success(`Pratinjau berhasil: ${(result.entries || []).length} aset ditemukan`)
            } else {
                toast.error(result?.error || "Gagal memuat pratinjau penyusutan")
            }
        } catch {
            toast.error("Terjadi kesalahan saat memuat pratinjau")
        } finally {
            setPreviewing(false)
        }
    }

    const handlePost = async () => {
        if (!periodStart || !periodEnd) return
        setPosting(true)
        try {
            const result = await postDepreciationRun(periodStart, periodEnd)
            if (result?.success) {
                toast.success("Penyusutan berhasil diposting ke jurnal")
                setPreviewData(null)
                setHasPreview(false)
                setPeriodStart("")
                setPeriodEnd("")
                queryClient.invalidateQueries({ queryKey: queryKeys.depreciationRuns.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.fixedAssets.all })
            } else {
                toast.error(result?.error || "Gagal memposting penyusutan")
            }
        } catch {
            toast.error("Terjadi kesalahan saat memposting penyusutan")
        } finally {
            setPosting(false)
        }
    }

    const handleReverse = async (runId: string) => {
        const confirmed = window.confirm(
            "Apakah Anda yakin ingin membatalkan run penyusutan ini?\n\nJurnal yang telah dibuat akan di-void dan nilai akumulasi penyusutan akan dikembalikan."
        )
        if (!confirmed) return

        setReversingId(runId)
        try {
            const result = await reverseDepreciationRun(runId)
            if (result?.success) {
                toast.success("Run penyusutan berhasil dibatalkan")
                queryClient.invalidateQueries({ queryKey: queryKeys.depreciationRuns.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.fixedAssets.all })
            } else {
                toast.error(result?.error || "Gagal membatalkan run penyusutan")
            }
        } catch {
            toast.error("Terjadi kesalahan saat membatalkan penyusutan")
        } finally {
            setReversingId(null)
        }
    }

    const totalDepreciation = (previewData || []).reduce(
        (sum: number, item: any) => sum + (Number(item.depreciationAmount) || 0),
        0
    )

    return (
        <div className="mf-page min-h-screen space-y-4">
            {/* HEADER */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-purple-500">
                    <div className="flex items-center gap-3">
                        <Calculator className="h-6 w-6 text-purple-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900">Penyusutan Aset Tetap</h1>
                            <p className="text-zinc-600 text-xs font-bold mt-0.5">Jalankan dan kelola penyusutan periodik aset tetap</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href="/finance/fixed-assets">
                            <Button variant="outline" className="h-9 border-2 border-black font-bold uppercase text-[10px] tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all bg-white">
                                <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Kembali
                            </Button>
                        </Link>
                        <Button
                            variant="outline"
                            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.depreciationRuns.all })}
                            className="h-9 border-2 border-black font-bold uppercase text-[10px] tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all bg-white"
                        >
                            <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Refresh
                        </Button>
                    </div>
                </div>
            </div>

            {/* SECTION 1: JALANKAN PENYUSUTAN */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
                <div className="bg-zinc-50 border-b-2 border-black p-4">
                    <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                        <Play className="h-5 w-5 text-purple-500" />
                        Jalankan Penyusutan
                    </h2>
                </div>

                <div className="p-6 space-y-5">
                    {/* Warning Banner */}
                    <div className="bg-amber-50 border-2 border-amber-400 p-4 flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-sm text-amber-800">Perhatian: Kunci Periode Fiskal</p>
                            <p className="text-xs text-amber-700 mt-1">
                                Pastikan periode fiskal yang dipilih belum dikunci. Penyusutan yang sudah diposting akan membuat jurnal otomatis dan mengubah nilai akumulasi penyusutan setiap aset.
                            </p>
                        </div>
                    </div>

                    {/* Period Selection */}
                    <div className="flex items-end gap-4">
                        <div className="flex-1">
                            <label className={NB.label}>
                                Periode Awal <span className={NB.labelRequired}>*</span>
                            </label>
                            <Input
                                type="date"
                                value={periodStart}
                                onChange={e => {
                                    setPeriodStart(e.target.value)
                                    setHasPreview(false)
                                    setPreviewData(null)
                                }}
                                className={NB.input}
                            />
                        </div>
                        <div className="flex-1">
                            <label className={NB.label}>
                                Periode Akhir <span className={NB.labelRequired}>*</span>
                            </label>
                            <Input
                                type="date"
                                value={periodEnd}
                                onChange={e => {
                                    setPeriodEnd(e.target.value)
                                    setHasPreview(false)
                                    setPreviewData(null)
                                }}
                                className={NB.input}
                            />
                        </div>
                        <Button
                            onClick={handlePreview}
                            disabled={previewing || !periodStart || !periodEnd}
                            className="h-10 bg-purple-600 text-white hover:bg-purple-700 border-2 border-purple-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase font-black text-[10px] tracking-wider hover:translate-y-[1px] hover:shadow-none transition-all px-6"
                        >
                            {previewing ? (
                                <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Memproses...</>
                            ) : (
                                <><Calculator className="mr-2 h-3.5 w-3.5" /> Pratinjau</>
                            )}
                        </Button>
                    </div>

                    {/* Preview Table */}
                    {previewData && previewData.length > 0 && (
                        <div className="space-y-4">
                            <div className={NB.tableWrap}>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className={NB.tableHead}>
                                                {["Kode Aset", "Nama Aset", "Kategori", "Penyusutan", "Akumulasi Setelah", "Nilai Buku Setelah"].map(h => (
                                                    <th key={h} className={NB.tableHeadCell + " text-left"}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewData.map((item: any, idx: number) => (
                                                <tr key={item.assetId || idx} className={NB.tableRow + " hover:bg-zinc-50 transition-colors"}>
                                                    <td className={NB.tableCell + " font-mono font-bold text-purple-700"}>{item.assetCode}</td>
                                                    <td className={NB.tableCell + " font-bold"}>{item.assetName}</td>
                                                    <td className={NB.tableCell + " text-zinc-600"}>{item.categoryName}</td>
                                                    <td className={NB.tableCell + " font-mono font-bold text-red-600"}>{formatCurrency(Number(item.depreciationAmount) || 0)}</td>
                                                    <td className={NB.tableCell + " font-mono font-bold text-amber-600"}>{formatCurrency(Number(item.accumulatedAfter) || 0)}</td>
                                                    <td className={NB.tableCell + " font-mono font-bold text-indigo-700"}>{formatCurrency(Number(item.bookValueAfter) || 0)}</td>
                                                </tr>
                                            ))}
                                            {/* Total Row */}
                                            <tr className="border-t-2 border-black bg-zinc-50">
                                                <td colSpan={3} className={NB.tableCell + " font-black uppercase text-[10px] tracking-widest text-zinc-500 text-right"}>Total Penyusutan</td>
                                                <td className={NB.tableCell + " font-mono font-black text-red-700 text-base"}>{formatCurrency(totalDepreciation)}</td>
                                                <td colSpan={2} />
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Post Button */}
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-zinc-500 font-medium">
                                    <CheckCircle className="inline h-3.5 w-3.5 text-emerald-500 mr-1" />
                                    {previewData.length} aset siap diproses penyusutan
                                </p>
                                <Button
                                    onClick={handlePost}
                                    disabled={posting}
                                    className="h-10 bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-[10px] tracking-wider px-8"
                                >
                                    {posting ? (
                                        <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Memposting...</>
                                    ) : (
                                        <><Play className="mr-2 h-3.5 w-3.5" /> Posting Penyusutan</>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Empty Preview State */}
                    {previewData && previewData.length === 0 && (
                        <div className="text-center py-12 border-2 border-dashed border-zinc-300">
                            <Calculator className="h-10 w-10 mx-auto mb-3 text-zinc-300" />
                            <p className="font-bold text-zinc-500">Tidak ada aset untuk disusutkan</p>
                            <p className="text-xs text-zinc-400 mt-1">Semua aset sudah disusutkan penuh atau tidak ada aset aktif dalam periode ini</p>
                        </div>
                    )}
                </div>
            </div>

            {/* SECTION 2: RIWAYAT PENYUSUTAN */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
                <div className="bg-zinc-50 border-b-2 border-black p-4">
                    <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                        <RefreshCcw className="h-5 w-5 text-purple-500" />
                        Riwayat Penyusutan
                    </h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b-2 border-black bg-zinc-50">
                                {["Tanggal Run", "Periode", "Jumlah Aset", "Total Penyusutan", "Status", "Aksi"].map(h => (
                                    <th key={h} className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-3 text-left">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {runs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-16 text-zinc-400">
                                        <Calculator className="h-10 w-10 mx-auto mb-3 text-zinc-200" />
                                        <p className="font-bold text-lg text-zinc-500">Belum ada riwayat penyusutan</p>
                                        <p className="text-sm mt-1">Jalankan penyusutan di atas untuk memulai</p>
                                    </td>
                                </tr>
                            ) : (
                                runs.map((run: any) => {
                                    const status = statusConfig[run.status] || statusConfig.PREVIEW
                                    const runDate = run.createdAt
                                        ? new Date(run.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
                                        : "-"
                                    const periodLabel = run.periodStart && run.periodEnd
                                        ? `${new Date(run.periodStart).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })} — ${new Date(run.periodEnd).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}`
                                        : "-"

                                    return (
                                        <tr key={run.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                                            <td className="px-4 py-3 font-mono font-bold text-sm">{runDate}</td>
                                            <td className="px-4 py-3 text-sm font-medium text-zinc-600">{periodLabel}</td>
                                            <td className="px-4 py-3 font-mono font-bold text-sm text-center">{run.totalAssets ?? run._count?.entries ?? "-"}</td>
                                            <td className="px-4 py-3 font-mono font-bold text-sm text-red-600">{formatCurrency(Number(run.totalDepreciation) || 0)}</td>
                                            <td className="px-4 py-3">
                                                <Badge variant="outline" className={`text-[10px] font-black uppercase border-2 ${status.color}`}>
                                                    {status.label}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3">
                                                {run.status === "POSTED" && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={reversingId === run.id}
                                                        onClick={() => handleReverse(run.id)}
                                                        className="h-7 text-[10px] font-black uppercase border-2 border-red-300 text-red-600 hover:bg-red-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all"
                                                    >
                                                        {reversingId === run.id ? (
                                                            <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Proses...</>
                                                        ) : (
                                                            <><Undo2 className="mr-1 h-3 w-3" /> Batalkan</>
                                                        )}
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

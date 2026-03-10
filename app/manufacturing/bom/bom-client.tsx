"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CreateBOMDialog } from "@/components/manufacturing/bom/create-bom-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
    Plus, Search, RefreshCcw, Package, Layers, Cog,
    ArrowRight, Scissors, Shirt, Droplets, ShieldCheck, ArchiveRestore, Loader2, Copy, Trash2,
} from "lucide-react"

const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val)

const STATION_ICONS: Record<string, any> = {
    CUTTING: Scissors, SEWING: Shirt, WASHING: Droplets, QC: ShieldCheck,
}

interface BOMListClientProps {
    boms: any[]
}

export function BOMListClient({ boms }: BOMListClientProps) {
    const router = useRouter()
    const queryClient = useQueryClient()
    const [search, setSearch] = useState("")
    const [createOpen, setCreateOpen] = useState(false)
    const [migratingId, setMigratingId] = useState<string | null>(null)
    const [cloningId, setCloningId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    // Prefetch BOM detail + process stations on hover for instant canvas load
    const handleCardHover = useCallback((bomId: string) => {
        router.prefetch(`/manufacturing/bom/${bomId}`)
        queryClient.prefetchQuery({
            queryKey: queryKeys.productionBom.detail(bomId),
            queryFn: async () => {
                const res = await fetch(`/api/manufacturing/production-bom/${bomId}`)
                if (!res.ok) return null
                const result = await res.json()
                return result.success ? result.data : null
            },
        })
        // Also prefetch process stations (needed by canvas)
        queryClient.prefetchQuery({
            queryKey: queryKeys.processStations.list(),
            queryFn: async () => {
                const res = await fetch("/api/manufacturing/process-stations")
                const result = await res.json()
                return result.success ? result.data : []
            },
        })
    }, [router, queryClient])

    const handleCardClick = useCallback(async (bom: any, e: React.MouseEvent) => {
        // New production BOMs — navigate directly
        if (bom._source !== 'legacy') {
            router.push(`/manufacturing/bom/${bom.id}`)
            return
        }

        // Legacy BOM — migrate first, then navigate
        e.preventDefault()
        setMigratingId(bom.id)
        try {
            const res = await fetch('/api/manufacturing/production-bom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: bom.productId,
                    migrateFromLegacyId: bom._legacyId || bom.id,
                }),
            })
            const data = await res.json()
            if (!data.success) throw new Error(data.error || 'Migrasi gagal')
            toast.success('BOM berhasil dimigrasi ke format baru')
            queryClient.invalidateQueries({ queryKey: queryKeys.productionBom.all })
            router.push(`/manufacturing/bom/${data.data.id}`)
        } catch (err: any) {
            toast.error(err.message || 'Gagal migrasi BOM')
        } finally {
            setMigratingId(null)
        }
    }, [router, queryClient])

    const handleClone = useCallback(async (bomId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setCloningId(bomId)
        try {
            const res = await fetch('/api/manufacturing/production-bom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cloneFromId: bomId }),
            })
            const data = await res.json()
            if (!data.success) throw new Error(data.error || 'Duplikasi gagal')
            toast.success('BOM berhasil diduplikasi')
            queryClient.invalidateQueries({ queryKey: queryKeys.productionBom.all })
            router.push(`/manufacturing/bom/${data.data.id}`)
        } catch (err: any) {
            toast.error(err.message || 'Gagal menduplikasi BOM')
        } finally {
            setCloningId(null)
        }
    }, [router, queryClient])

    const handleDelete = useCallback(async (bomId: string, productName: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!window.confirm(`Hapus BOM untuk "${productName}"?\n\nSPK yang sudah di-generate tidak akan dihapus, tapi linknya akan terputus.`)) return
        setDeletingId(bomId)
        try {
            const res = await fetch(`/api/manufacturing/production-bom/${bomId}`, { method: 'DELETE' })
            const data = await res.json()
            if (!data.success) throw new Error(data.error || 'Gagal menghapus')
            toast.success('BOM berhasil dihapus')
            queryClient.invalidateQueries({ queryKey: queryKeys.productionBom.all })
        } catch (err: any) {
            toast.error(err.message || 'Gagal menghapus BOM')
        } finally {
            setDeletingId(null)
        }
    }, [queryClient])

    const filtered = useMemo(() => {
        if (!search) return boms
        const q = search.toLowerCase()
        return boms.filter((b: any) =>
            b.product?.name?.toLowerCase().includes(q) ||
            b.product?.code?.toLowerCase().includes(q) ||
            b.version?.toLowerCase().includes(q)
        )
    }, [boms, search])

    const summary = useMemo(() => ({
        total: boms.length,
        active: boms.filter((b: any) => b.isActive).length,
        legacy: boms.filter((b: any) => b._source === 'legacy').length,
        totalMaterials: boms.reduce((sum: number, b: any) => sum + (b.materialCount || 0), 0),
        totalSteps: boms.reduce((sum: number, b: any) => sum + (b.stepCount || 0), 0),
    }), [boms])

    return (
        <div className="mf-page min-h-screen space-y-4">
            {/* HEADER */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white rounded-none">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-orange-500">
                    <div className="flex items-center gap-3">
                        <Package className="h-6 w-6 text-orange-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900">
                                Production BOM
                            </h1>
                            <p className="text-zinc-600 text-xs font-bold mt-0.5">
                                Bill of Materials dengan alur produksi visual (canvas editor)
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.productionBom.all })}
                            className="h-9 border-2 border-black font-bold uppercase text-[10px] tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all rounded-none bg-white"
                        >
                            <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Refresh
                        </Button>
                        <Button
                            onClick={() => setCreateOpen(true)}
                            className="h-9 bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase font-black text-[10px] tracking-wider hover:translate-y-[1px] hover:shadow-none transition-all rounded-none px-4"
                        >
                            <Plus className="mr-2 h-3.5 w-3.5" /> Buat BOM Baru
                        </Button>
                    </div>
                </div>
            </div>

            {/* KPI STRIP */}
            <div className="bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden rounded-none">
                <div className="grid grid-cols-4">
                    <div className="relative p-4 border-r-2 border-zinc-100">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-orange-500" />
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total BOM</div>
                        <div className="text-2xl font-black">{summary.total}</div>
                    </div>
                    <div className="relative p-4 border-r-2 border-zinc-100">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Aktif</div>
                        <div className="text-2xl font-black text-emerald-600">{summary.active}</div>
                    </div>
                    <div className="relative p-4 border-r-2 border-zinc-100">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Legacy</div>
                        <div className="text-2xl font-black text-amber-600">{summary.legacy}</div>
                    </div>
                    <div className="relative p-4">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total Material</div>
                        <div className="text-2xl font-black text-blue-600">{summary.totalMaterials}</div>
                    </div>
                </div>
            </div>

            {/* SEARCH + GRID */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white rounded-none flex flex-col min-h-[400px]">
                <div className="p-4 border-b-2 border-black flex items-center justify-between bg-zinc-50">
                    <h2 className="text-lg font-black uppercase tracking-tight">Daftar BOM</h2>
                    <div className="relative w-[320px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                            placeholder="Cari produk atau kode..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 border-2 border-zinc-200 focus-visible:ring-0 focus-visible:border-black font-bold h-10 rounded-none bg-white"
                        />
                    </div>
                </div>

                <div className="p-6 bg-zinc-100/30 flex-1">
                    {filtered.length === 0 ? (
                        <div className="text-center py-20 border-2 border-dashed border-zinc-300 bg-white rounded-none">
                            <Package className="h-12 w-12 text-zinc-200 mx-auto mb-4" />
                            <p className="text-zinc-500 font-bold text-lg">Belum ada Production BOM</p>
                            <p className="text-zinc-400 text-sm mt-1">Buat BOM baru untuk memulai alur produksi</p>
                            <Button onClick={() => setCreateOpen(true)} className="mt-4 bg-black text-white font-black uppercase text-[10px] rounded-none">
                                <Plus className="mr-2 h-3.5 w-3.5" /> Buat BOM Pertama
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {filtered.map((bom: any) => {
                                const isLegacy = bom._source === 'legacy'
                                const isMigrating = migratingId === bom.id
                                return (
                                    <div
                                        key={bom.id}
                                        onMouseEnter={() => !isLegacy && handleCardHover(bom.id)}
                                        onClick={(e) => !isMigrating && handleCardClick(bom, e)}
                                        className="block border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all group cursor-pointer"
                                    >
                                        {/* Card header */}
                                        <div className={`px-4 py-3 border-b-2 border-black flex items-center justify-between ${isLegacy ? 'bg-amber-50' : 'bg-orange-50'}`}>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-black text-sm uppercase truncate">{bom.product?.name}</p>
                                                <p className="text-[10px] font-mono font-bold text-zinc-400">{bom.product?.code}</p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {!isLegacy && (
                                                    <>
                                                        <button
                                                            onClick={(e) => handleClone(bom.id, e)}
                                                            disabled={cloningId === bom.id}
                                                            className="bg-white border-2 border-black text-[9px] font-black px-2 py-0.5 uppercase flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                            title="Duplikat BOM"
                                                        >
                                                            {cloningId === bom.id ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : (
                                                                <Copy className="h-3 w-3" />
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleDelete(bom.id, bom.product?.name || '', e)}
                                                            disabled={deletingId === bom.id}
                                                            className="bg-white border-2 border-red-400 text-red-500 text-[9px] font-black px-1.5 py-0.5 uppercase flex items-center shadow-[2px_2px_0px_0px_rgba(239,68,68,0.4)] hover:translate-y-[1px] hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                            title="Hapus BOM"
                                                        >
                                                            {deletingId === bom.id ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="h-3 w-3" />
                                                            )}
                                                        </button>
                                                    </>
                                                )}
                                                {isLegacy && (
                                                    <span className="bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 flex items-center gap-1">
                                                        <ArchiveRestore className="h-3 w-3" /> LEGACY
                                                    </span>
                                                )}
                                                <span className="bg-black text-white text-[9px] font-black px-2 py-0.5">{bom.version}</span>
                                                {bom.isActive ? (
                                                    <span className="bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5">AKTIF</span>
                                                ) : (
                                                    <span className="bg-zinc-400 text-white text-[9px] font-black px-2 py-0.5">NONAKTIF</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Card body */}
                                        <div className="px-4 py-3 space-y-2">
                                            {/* Steps preview */}
                                            {bom.steps && bom.steps.length > 0 ? (
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    {bom.steps.slice(0, 5).map((step: any, i: number) => {
                                                        const Icon = STATION_ICONS[step.station?.stationType] || Cog
                                                        return (
                                                            <div key={step.id || i} className="flex items-center gap-1">
                                                                {i > 0 && <ArrowRight className="h-3 w-3 text-zinc-300" />}
                                                                <div className="flex items-center gap-1 bg-zinc-100 px-1.5 py-0.5 border border-zinc-200">
                                                                    <Icon className="h-3 w-3 text-zinc-500" />
                                                                    <span className="text-[9px] font-bold text-zinc-600 truncate max-w-[60px]">{step.station?.name}</span>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                    {bom.steps.length > 5 && (
                                                        <span className="text-[9px] font-bold text-zinc-400">+{bom.steps.length - 5}</span>
                                                    )}
                                                </div>
                                            ) : isLegacy ? (
                                                <p className="text-[10px] text-amber-500 font-bold">Klik untuk migrasi ke canvas editor</p>
                                            ) : (
                                                <p className="text-[10px] text-zinc-300 font-bold">Belum ada alur proses</p>
                                            )}

                                            {/* Stats */}
                                            <div className="grid grid-cols-3 gap-2 pt-1">
                                                <div className="text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Layers className="h-3 w-3 text-zinc-400" />
                                                        <span className="text-[10px] font-black text-zinc-500">Material</span>
                                                    </div>
                                                    <p className="font-black text-sm">{bom.materialCount || 0}</p>
                                                </div>
                                                <div className="text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Cog className="h-3 w-3 text-zinc-400" />
                                                        <span className="text-[10px] font-black text-zinc-500">Proses</span>
                                                    </div>
                                                    <p className="font-black text-sm">{bom.stepCount || 0}</p>
                                                </div>
                                                <div className="text-center">
                                                    <span className="text-[10px] font-black text-zinc-500">Biaya/pcs</span>
                                                    <p className="font-black text-xs font-mono">{formatCurrency(bom.totalCostPerUnit || 0)}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card footer */}
                                        <div className="px-4 py-2 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between">
                                            <span className="text-[9px] font-bold text-zinc-400">
                                                Target: {bom.totalProductionQty || 0} pcs
                                            </span>
                                            {isMigrating ? (
                                                <span className="text-[9px] font-black text-amber-600 uppercase flex items-center gap-1">
                                                    <Loader2 className="h-3 w-3 animate-spin" /> Migrasi...
                                                </span>
                                            ) : isLegacy ? (
                                                <span className="text-[9px] font-black text-amber-600 uppercase group-hover:underline">
                                                    Migrasi & Buka Canvas →
                                                </span>
                                            ) : (
                                                <span className="text-[9px] font-black text-orange-600 uppercase group-hover:underline">
                                                    Buka Canvas →
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            <CreateBOMDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={(bom) => {
                    router.push(`/manufacturing/bom/${bom.id}`)
                }}
            />
        </div>
    )
}

"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { useFixedAssets, useFixedAssetCategories } from "@/hooks/use-fixed-assets"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { CreateAssetDialog } from "@/components/finance/fixed-assets/create-asset-dialog"
import { AssetMovementDialog } from "@/components/finance/fixed-assets/asset-movement-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import {
    Building, Plus, RefreshCcw, Search, ArrowRightLeft,
    Settings, FolderTree, Calculator, FileBarChart,
} from "lucide-react"

export const dynamic = "force-dynamic"

const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val)

const statusLabels: Record<string, { label: string; color: string }> = {
    DRAFT: { label: "Draf", color: "bg-zinc-100 text-zinc-700 border-zinc-300" },
    ACTIVE: { label: "Aktif", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
    FULLY_DEPRECIATED: { label: "Disusutkan Penuh", color: "bg-amber-100 text-amber-700 border-amber-300" },
    DISPOSED: { label: "Dihapus", color: "bg-red-100 text-red-700 border-red-300" },
    SOLD: { label: "Dijual", color: "bg-blue-100 text-blue-700 border-blue-300" },
    WRITTEN_OFF: { label: "Dihapusbukukan", color: "bg-red-100 text-red-700 border-red-300" },
}

const methodLabels: Record<string, string> = {
    STRAIGHT_LINE: "Garis Lurus",
    DECLINING_BALANCE: "Saldo Menurun",
    UNITS_OF_PRODUCTION: "Unit Produksi",
}

export default function FixedAssetsPage() {
    const queryClient = useQueryClient()
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("")
    const [categoryFilter, setCategoryFilter] = useState<string>("")
    const [createOpen, setCreateOpen] = useState(false)
    const [movementAsset, setMovementAsset] = useState<any>(null)

    const { data, isLoading } = useFixedAssets({
        search: search || undefined,
        status: statusFilter || undefined,
        categoryId: categoryFilter || undefined,
    })
    const { data: catData } = useFixedAssetCategories()

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-purple-400" />

    const { assets, summary } = data

    return (
        <div className="mf-page min-h-screen space-y-4">
            {/* HEADER */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-purple-500">
                    <div className="flex items-center gap-3">
                        <Building className="h-6 w-6 text-purple-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900">Daftar Aset Tetap</h1>
                            <p className="text-zinc-600 text-xs font-bold mt-0.5">Kelola aset tetap perusahaan dan penyusutannya</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href="/finance/fixed-assets/settings">
                            <Button variant="outline" className="h-9 border-2 border-black font-bold uppercase text-[10px] tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all bg-white">
                                <Settings className="mr-2 h-3.5 w-3.5" /> Pengaturan
                            </Button>
                        </Link>
                        <Link href="/finance/fixed-assets/categories">
                            <Button variant="outline" className="h-9 border-2 border-black font-bold uppercase text-[10px] tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all bg-white">
                                <FolderTree className="mr-2 h-3.5 w-3.5" /> Kategori
                            </Button>
                        </Link>
                        <Link href="/finance/fixed-assets/depreciation">
                            <Button variant="outline" className="h-9 border-2 border-black font-bold uppercase text-[10px] tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all bg-white">
                                <Calculator className="mr-2 h-3.5 w-3.5" /> Penyusutan
                            </Button>
                        </Link>
                        <Link href="/finance/fixed-assets/reports">
                            <Button variant="outline" className="h-9 border-2 border-black font-bold uppercase text-[10px] tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all bg-white">
                                <FileBarChart className="mr-2 h-3.5 w-3.5" /> Laporan
                            </Button>
                        </Link>
                        <Button
                            variant="outline"
                            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.fixedAssets.all })}
                            className="h-9 border-2 border-black font-bold uppercase text-[10px] tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all bg-white"
                        >
                            <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Refresh
                        </Button>
                        <Button
                            onClick={() => setCreateOpen(true)}
                            className="h-9 bg-purple-600 text-white hover:bg-purple-700 border-2 border-purple-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase font-black text-[10px] tracking-wider hover:translate-y-[1px] hover:shadow-none transition-all px-4"
                        >
                            <Plus className="mr-2 h-3.5 w-3.5" /> Tambah Aset
                        </Button>
                    </div>
                </div>
            </div>

            {/* KPI STRIP */}
            <div className="bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-5">
                    {[
                        { label: "Total Aset", value: summary.totalAssets, format: "number", color: "bg-purple-500" },
                        { label: "Aset Aktif", value: summary.activeCount, format: "number", color: "bg-emerald-500" },
                        { label: "Harga Perolehan", value: summary.totalCost, format: "currency", color: "bg-blue-500" },
                        { label: "Akum. Penyusutan", value: summary.totalAccDep, format: "currency", color: "bg-amber-500" },
                        { label: "Nilai Buku Bersih", value: summary.totalNBV, format: "currency", color: "bg-indigo-500" },
                    ].map((kpi, i) => (
                        <div key={i} className={`relative p-4 ${i < 4 ? "border-r-2 border-zinc-100" : ""}`}>
                            <div className={`absolute top-0 left-0 right-0 h-1 ${kpi.color}`} />
                            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">{kpi.label}</div>
                            <div className="text-xl font-black text-zinc-900">
                                {kpi.format === "currency" ? formatCurrency(kpi.value) : kpi.value}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* FILTERS */}
            <div className="bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] p-4">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                            placeholder="Cari nama, kode, atau nomor seri..."
                            className="pl-10 border-2 border-black h-9 font-medium"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <Select value={statusFilter || "all"} onValueChange={v => setStatusFilter(v === "all" ? "" : v)}>
                        <SelectTrigger className="w-48 border-2 border-black h-9 font-bold text-xs">
                            <SelectValue placeholder="Semua Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Status</SelectItem>
                            <SelectItem value="ACTIVE">Aktif</SelectItem>
                            <SelectItem value="FULLY_DEPRECIATED">Disusutkan Penuh</SelectItem>
                            <SelectItem value="DISPOSED">Dihapus</SelectItem>
                            <SelectItem value="SOLD">Dijual</SelectItem>
                            <SelectItem value="WRITTEN_OFF">Dihapusbukukan</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={categoryFilter || "all"} onValueChange={v => setCategoryFilter(v === "all" ? "" : v)}>
                        <SelectTrigger className="w-48 border-2 border-black h-9 font-bold text-xs">
                            <SelectValue placeholder="Semua Kategori" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Kategori</SelectItem>
                            {(catData?.categories || []).map((c: any) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* TABLE */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b-2 border-black bg-zinc-50">
                                {["Kode", "Nama Aset", "Kategori", "Harga Perolehan", "Akum. Penyusutan", "Nilai Buku", "Metode", "Status", "Aksi"].map(h => (
                                    <th key={h} className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-3 text-left">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {assets.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-20 text-zinc-400">
                                        <Building className="h-12 w-12 mx-auto mb-4 text-zinc-200" />
                                        <p className="font-bold text-lg text-zinc-500">Belum ada aset tetap</p>
                                        <p className="text-sm mt-1">Klik "Tambah Aset" untuk mendaftarkan aset pertama</p>
                                    </td>
                                </tr>
                            ) : (
                                assets.map((asset: any) => {
                                    const status = statusLabels[asset.status] || statusLabels.DRAFT
                                    return (
                                        <tr key={asset.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                                            <td className="px-4 py-3 font-mono font-bold text-sm text-purple-700">{asset.assetCode}</td>
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-sm">{asset.name}</div>
                                                {asset.serialNumber && <div className="text-[10px] text-zinc-400 font-mono">SN: {asset.serialNumber}</div>}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium text-zinc-600">{asset.category?.name}</td>
                                            <td className="px-4 py-3 font-mono font-bold text-sm">{formatCurrency(Number(asset.purchaseCost))}</td>
                                            <td className="px-4 py-3 font-mono font-bold text-sm text-amber-600">{formatCurrency(Number(asset.accumulatedDepreciation))}</td>
                                            <td className="px-4 py-3 font-mono font-bold text-sm text-indigo-700">{formatCurrency(Number(asset.netBookValue))}</td>
                                            <td className="px-4 py-3 text-xs font-medium text-zinc-500">{methodLabels[asset.depreciationMethod]}</td>
                                            <td className="px-4 py-3">
                                                <Badge variant="outline" className={`text-[10px] font-black uppercase border-2 ${status.color}`}>
                                                    {status.label}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3">
                                                {(asset.status === "ACTIVE" || asset.status === "FULLY_DEPRECIATED") && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setMovementAsset({
                                                            id: asset.id,
                                                            assetCode: asset.assetCode,
                                                            name: asset.name,
                                                            netBookValue: Number(asset.netBookValue),
                                                            location: asset.location,
                                                            department: asset.department,
                                                        })}
                                                        className="h-7 text-[10px] font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all"
                                                    >
                                                        <ArrowRightLeft className="mr-1 h-3 w-3" /> Aksi
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

            <CreateAssetDialog open={createOpen} onOpenChange={setCreateOpen} />
            <AssetMovementDialog open={!!movementAsset} onOpenChange={(o) => !o && setMovementAsset(null)} asset={movementAsset} />
        </div>
    )
}

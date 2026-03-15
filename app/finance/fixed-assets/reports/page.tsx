"use client"

import { useState, Fragment } from "react"
import { useAssetRegisterReport, useDepreciationScheduleReport, useAssetMovementReport, useNetBookValueSummary } from "@/hooks/use-fixed-assets"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import Link from "next/link"
import { FileBarChart, ArrowLeft, CheckCircle, Circle, Building } from "lucide-react"

export const dynamic = "force-dynamic"

const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val)

const formatDate = (date: string | Date) =>
    new Date(date).toLocaleDateString("id-ID")

const statusLabels: Record<string, { label: string; color: string }> = {
    DRAFT: { label: "Draf", color: "bg-zinc-100 text-zinc-700 border-zinc-300" },
    ACTIVE: { label: "Aktif", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
    FULLY_DEPRECIATED: { label: "Disusutkan Penuh", color: "bg-amber-100 text-amber-700 border-amber-300" },
    DISPOSED: { label: "Dihapus", color: "bg-red-100 text-red-700 border-red-300" },
    SOLD: { label: "Dijual", color: "bg-blue-100 text-blue-700 border-blue-300" },
    WRITTEN_OFF: { label: "Dihapusbukukan", color: "bg-red-100 text-red-700 border-red-300" },
}

const movementTypeLabels: Record<string, string> = {
    DISPOSAL: "Penghapusan",
    SALE: "Penjualan",
    WRITE_OFF: "Hapus Buku",
    TRANSFER: "Transfer",
}

type TabKey = "register" | "schedule" | "movements" | "nbv"

const tabs: { key: TabKey; label: string }[] = [
    { key: "register", label: "Register Aset" },
    { key: "schedule", label: "Jadwal Penyusutan" },
    { key: "movements", label: "Pergerakan Aset" },
    { key: "nbv", label: "Ringkasan Nilai Buku" },
]

// ============================================================
// Tab 1: Laporan Register Aset
// ============================================================
function AssetRegisterTab() {
    const { data, isLoading } = useAssetRegisterReport()

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-purple-400" />

    const assets = data.assets || []

    // Group by category
    const grouped: Record<string, { categoryName: string; items: any[] }> = {}
    for (const asset of assets) {
        const catName = asset.category?.name || "Tanpa Kategori"
        if (!grouped[catName]) grouped[catName] = { categoryName: catName, items: [] }
        grouped[catName].items.push(asset)
    }

    return (
        <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b-2 border-black bg-zinc-50">
                            {["Kode", "Nama", "Kategori", "Supplier", "Tgl Pembelian", "Harga Perolehan", "Akum. Penyusutan", "Nilai Buku", "Status"].map(h => (
                                <th key={h} className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-3 text-left">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {assets.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="text-center py-20 text-zinc-400">
                                    <Building className="h-12 w-12 mx-auto mb-4 text-zinc-200" />
                                    <p className="font-bold text-lg text-zinc-500">Belum ada data aset</p>
                                    <p className="text-sm mt-1">Data akan muncul setelah aset ditambahkan</p>
                                </td>
                            </tr>
                        ) : (
                            Object.entries(grouped).map(([catName, group]) => {
                                const subtotalCost = group.items.reduce((s: number, a: any) => s + Number(a.purchaseCost), 0)
                                const subtotalAccDep = group.items.reduce((s: number, a: any) => s + Number(a.accumulatedDepreciation), 0)
                                const subtotalNBV = group.items.reduce((s: number, a: any) => s + Number(a.netBookValue), 0)

                                return (
                                    <Fragment key={catName}>
                                        {/* Category header */}
                                        <tr className="bg-purple-50 border-b border-purple-200">
                                            <td colSpan={9} className="px-4 py-2">
                                                <span className="text-xs font-black uppercase tracking-wider text-purple-700">{catName}</span>
                                                <span className="ml-2 text-[10px] font-bold text-purple-400">({group.items.length} aset)</span>
                                            </td>
                                        </tr>
                                        {group.items.map((asset: any) => {
                                            const status = statusLabels[asset.status] || statusLabels.DRAFT
                                            return (
                                                <tr key={asset.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                                                    <td className="px-4 py-3 font-mono font-bold text-sm text-purple-700">{asset.assetCode}</td>
                                                    <td className="px-4 py-3 font-bold text-sm">{asset.name}</td>
                                                    <td className="px-4 py-3 text-sm font-medium text-zinc-600">{asset.category?.name}</td>
                                                    <td className="px-4 py-3 text-sm font-medium text-zinc-600">{asset.supplier?.name || "-"}</td>
                                                    <td className="px-4 py-3 text-sm font-medium text-zinc-600">{formatDate(asset.purchaseDate)}</td>
                                                    <td className="px-4 py-3 font-mono font-bold text-sm">{formatCurrency(Number(asset.purchaseCost))}</td>
                                                    <td className="px-4 py-3 font-mono font-bold text-sm text-amber-600">{formatCurrency(Number(asset.accumulatedDepreciation))}</td>
                                                    <td className="px-4 py-3 font-mono font-bold text-sm text-indigo-700">{formatCurrency(Number(asset.netBookValue))}</td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant="outline" className={`text-[10px] font-black uppercase border-2 ${status.color}`}>
                                                            {status.label}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                        {/* Category subtotal */}
                                        <tr className="bg-zinc-50 border-b-2 border-zinc-200">
                                            <td colSpan={5} className="px-4 py-2 text-right text-[10px] font-black uppercase tracking-widest text-zinc-500">Subtotal {catName}</td>
                                            <td className="px-4 py-2 font-mono font-black text-sm">{formatCurrency(subtotalCost)}</td>
                                            <td className="px-4 py-2 font-mono font-black text-sm text-amber-600">{formatCurrency(subtotalAccDep)}</td>
                                            <td className="px-4 py-2 font-mono font-black text-sm text-indigo-700">{formatCurrency(subtotalNBV)}</td>
                                            <td />
                                        </tr>
                                    </Fragment>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// ============================================================
// Tab 2: Jadwal Penyusutan
// ============================================================
function DepreciationScheduleTab() {
    const [assetFilter, setAssetFilter] = useState<string>("")
    const { data, isLoading } = useDepreciationScheduleReport(assetFilter || undefined)

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-purple-400" />

    const schedules = data.schedules || []

    // Build unique asset list for the filter dropdown
    const uniqueAssets: Record<string, { code: string; name: string }> = {}
    for (const s of schedules) {
        if (s.asset && !uniqueAssets[s.assetId]) {
            uniqueAssets[s.assetId] = { code: s.asset.assetCode, name: s.asset.name }
        }
    }

    return (
        <div className="space-y-4">
            {/* Filter */}
            <div className="bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] p-4">
                <div className="flex items-center gap-3">
                    <label className="text-xs font-black uppercase tracking-wider text-zinc-600">Filter Aset:</label>
                    <select
                        value={assetFilter}
                        onChange={(e) => setAssetFilter(e.target.value)}
                        className="border-2 border-black h-9 px-3 text-sm font-bold bg-white min-w-[280px]"
                    >
                        <option value="">Semua Aset</option>
                        {Object.entries(uniqueAssets).map(([id, a]) => (
                            <option key={id} value={id}>{a.code} - {a.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b-2 border-black bg-zinc-50">
                                {["Kode Aset", "Nama", "Periode", "Tgl Dijadwalkan", "Penyusutan", "Akumulasi", "Nilai Buku", "Status"].map(h => (
                                    <th key={h} className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-3 text-left">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {schedules.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-20 text-zinc-400">
                                        <Building className="h-12 w-12 mx-auto mb-4 text-zinc-200" />
                                        <p className="font-bold text-lg text-zinc-500">Belum ada jadwal penyusutan</p>
                                        <p className="text-sm mt-1">Jadwal akan dibuat otomatis saat aset diaktifkan</p>
                                    </td>
                                </tr>
                            ) : (
                                schedules.map((s: any) => (
                                    <tr key={s.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                                        <td className="px-4 py-3 font-mono font-bold text-sm text-purple-700">{s.asset?.assetCode}</td>
                                        <td className="px-4 py-3 font-bold text-sm">{s.asset?.name}</td>
                                        <td className="px-4 py-3 text-sm font-bold text-zinc-700">{s.periodNo}</td>
                                        <td className="px-4 py-3 text-sm font-medium text-zinc-600">{formatDate(s.scheduledDate)}</td>
                                        <td className="px-4 py-3 font-mono font-bold text-sm">{formatCurrency(Number(s.depreciationAmount))}</td>
                                        <td className="px-4 py-3 font-mono font-bold text-sm text-amber-600">{formatCurrency(Number(s.accumulatedAmount))}</td>
                                        <td className="px-4 py-3 font-mono font-bold text-sm text-indigo-700">{formatCurrency(Number(s.bookValueAfter))}</td>
                                        <td className="px-4 py-3">
                                            {s.isPosted ? (
                                                <span className="inline-flex items-center gap-1 text-emerald-600">
                                                    <CheckCircle className="h-4 w-4" />
                                                    <span className="text-[10px] font-black uppercase tracking-wider">Posted</span>
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-zinc-400">
                                                    <Circle className="h-4 w-4" />
                                                    <span className="text-[10px] font-black uppercase tracking-wider">Belum</span>
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

// ============================================================
// Tab 3: Laporan Pergerakan Aset
// ============================================================
function AssetMovementTab() {
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const { data, isLoading } = useAssetMovementReport(startDate || undefined, endDate || undefined)

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-purple-400" />

    const movements = data.movements || []

    return (
        <div className="space-y-4">
            {/* Date range filter */}
            <div className="bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] p-4">
                <div className="flex items-center gap-3">
                    <label className="text-xs font-black uppercase tracking-wider text-zinc-600">Dari:</label>
                    <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="border-2 border-black h-9 font-medium w-48"
                    />
                    <label className="text-xs font-black uppercase tracking-wider text-zinc-600">Sampai:</label>
                    <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="border-2 border-black h-9 font-medium w-48"
                    />
                    {(startDate || endDate) && (
                        <Button
                            variant="outline"
                            onClick={() => { setStartDate(""); setEndDate("") }}
                            className="h-9 border-2 border-black font-bold uppercase text-[10px] tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all bg-white"
                        >
                            Reset
                        </Button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b-2 border-black bg-zinc-50">
                                {["Tanggal", "Kode Aset", "Nama", "Tipe", "Hasil", "Laba/Rugi", "Catatan"].map(h => (
                                    <th key={h} className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-3 text-left">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {movements.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-20 text-zinc-400">
                                        <Building className="h-12 w-12 mx-auto mb-4 text-zinc-200" />
                                        <p className="font-bold text-lg text-zinc-500">Belum ada pergerakan aset</p>
                                        <p className="text-sm mt-1">Data akan muncul setelah ada disposal, penjualan, atau transfer aset</p>
                                    </td>
                                </tr>
                            ) : (
                                movements.map((m: any) => {
                                    const gainLoss = Number(m.gainLoss || 0)
                                    return (
                                        <tr key={m.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                                            <td className="px-4 py-3 text-sm font-medium text-zinc-600">{formatDate(m.date)}</td>
                                            <td className="px-4 py-3 font-mono font-bold text-sm text-purple-700">{m.asset?.assetCode}</td>
                                            <td className="px-4 py-3 font-bold text-sm">{m.asset?.name}</td>
                                            <td className="px-4 py-3">
                                                <Badge variant="outline" className="text-[10px] font-black uppercase border-2 border-zinc-300 bg-zinc-100 text-zinc-700">
                                                    {movementTypeLabels[m.type] || m.type}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 font-mono font-bold text-sm">
                                                {m.proceeds != null ? formatCurrency(Number(m.proceeds)) : "-"}
                                            </td>
                                            <td className="px-4 py-3 font-mono font-bold text-sm">
                                                {m.gainLoss != null ? (
                                                    <span className={gainLoss >= 0 ? "text-emerald-600" : "text-red-600"}>
                                                        {gainLoss >= 0 ? "+" : ""}{formatCurrency(gainLoss)}
                                                    </span>
                                                ) : "-"}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-zinc-500">{m.notes || "-"}</td>
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

// ============================================================
// Tab 4: Ringkasan Nilai Buku
// ============================================================
function NetBookValueTab() {
    const { data, isLoading } = useNetBookValueSummary()

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-purple-400" />

    const summary = data.summary || []

    const grandTotalCost = summary.reduce((s: number, c: any) => s + c.totalCost, 0)
    const grandTotalAccDep = summary.reduce((s: number, c: any) => s + c.totalAccDep, 0)
    const grandTotalNBV = summary.reduce((s: number, c: any) => s + c.totalNBV, 0)
    const grandTotalCount = summary.reduce((s: number, c: any) => s + c.count, 0)

    return (
        <div className="space-y-4">
            {/* Summary cards */}
            {summary.length === 0 ? (
                <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white p-20 text-center">
                    <Building className="h-12 w-12 mx-auto mb-4 text-zinc-200" />
                    <p className="font-bold text-lg text-zinc-500">Belum ada data aset aktif</p>
                    <p className="text-sm mt-1 text-zinc-400">Data akan muncul setelah aset diaktifkan</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {summary.map((cat: any, i: number) => (
                            <div key={i} className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
                                <div className="border-b-2 border-black bg-purple-50 px-4 py-3">
                                    <h3 className="text-sm font-black uppercase tracking-wider text-purple-800">{cat.name}</h3>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Jumlah Aset</span>
                                        <span className="font-black text-lg text-zinc-900">{cat.count}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Harga Perolehan</span>
                                        <span className="font-mono font-bold text-sm text-zinc-900">{formatCurrency(cat.totalCost)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Akum. Penyusutan</span>
                                        <span className="font-mono font-bold text-sm text-amber-600">{formatCurrency(cat.totalAccDep)}</span>
                                    </div>
                                    <div className="border-t-2 border-black pt-3 flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Nilai Buku</span>
                                        <span className="font-mono font-black text-lg text-indigo-700">{formatCurrency(cat.totalNBV)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Grand total */}
                    <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
                        <div className="border-b-2 border-black bg-zinc-900 px-4 py-3">
                            <h3 className="text-sm font-black uppercase tracking-wider text-white">Grand Total</h3>
                        </div>
                        <div className="p-4">
                            <div className="grid grid-cols-4 gap-4">
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Jumlah Aset</div>
                                    <div className="font-black text-xl text-zinc-900">{grandTotalCount}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total Harga Perolehan</div>
                                    <div className="font-mono font-black text-xl text-zinc-900">{formatCurrency(grandTotalCost)}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total Akum. Penyusutan</div>
                                    <div className="font-mono font-black text-xl text-amber-600">{formatCurrency(grandTotalAccDep)}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total Nilai Buku</div>
                                    <div className="font-mono font-black text-xl text-indigo-700">{formatCurrency(grandTotalNBV)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

// ============================================================
// Main Reports Page
// ============================================================
export default function FixedAssetReportsPage() {
    const [activeTab, setActiveTab] = useState<TabKey>("register")

    return (
        <div className="mf-page min-h-screen space-y-4">
            {/* HEADER */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-purple-500">
                    <div className="flex items-center gap-3">
                        <FileBarChart className="h-6 w-6 text-purple-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900">Laporan Aset Tetap</h1>
                            <p className="text-zinc-600 text-xs font-bold mt-0.5">Laporan register, penyusutan, pergerakan, dan nilai buku aset</p>
                        </div>
                    </div>
                    <Link href="/finance/fixed-assets">
                        <Button variant="outline" className="h-9 border-2 border-black font-bold uppercase text-[10px] tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all bg-white">
                            <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Kembali
                        </Button>
                    </Link>
                </div>
            </div>

            {/* TAB BUTTONS */}
            <div className="flex items-center gap-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2 border-2 border-black text-xs font-black uppercase tracking-wider transition-all ${
                            activeTab === tab.key
                                ? "bg-black text-white shadow-none"
                                : "bg-white text-zinc-700 hover:bg-zinc-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* TAB CONTENT */}
            {activeTab === "register" && <AssetRegisterTab />}
            {activeTab === "schedule" && <DepreciationScheduleTab />}
            {activeTab === "movements" && <AssetMovementTab />}
            {activeTab === "nbv" && <NetBookValueTab />}
        </div>
    )
}

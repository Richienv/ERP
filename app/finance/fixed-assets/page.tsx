"use client"

import { useState } from "react"
import { useFixedAssets, useFixedAssetCategories, useBackfillFixedAssetGL } from "@/hooks/use-fixed-assets"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { CreateAssetDialog } from "@/components/finance/fixed-assets/create-asset-dialog"
import { AssetMovementDialog } from "@/components/finance/fixed-assets/asset-movement-dialog"
import { Button } from "@/components/ui/button"
import { CheckboxFilter } from "@/components/ui/checkbox-filter"
import { NB } from "@/lib/dialog-styles"
import { toast } from "sonner"
import Link from "next/link"
import {
    Building, Plus, Search, ArrowRightLeft,
    Settings, FolderTree, Calculator, FileBarChart, X, RefreshCw,
} from "lucide-react"
import { motion } from "framer-motion"

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

export default function FixedAssetsPage() {
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("")
    const [categoryFilter, setCategoryFilter] = useState<string>("")
    const [createOpen, setCreateOpen] = useState(false)
    const [movementAsset, setMovementAsset] = useState<any>(null)
    const backfillMutation = useBackfillFixedAssetGL()

    const handleBackfill = () => {
        backfillMutation.mutate(undefined, {
            onSuccess: (result: any) => {
                if (!result?.success) {
                    toast.error(result?.error || "Sinkronisasi gagal")
                    return
                }
                if (result.processed === 0) {
                    toast.info(`Tidak ada aset yang perlu disinkronkan (${result.total} aset diperiksa)`)
                } else {
                    toast.success(`${result.processed} aset disinkronkan ke COA`)
                }
                if (result.skipped?.length) {
                    const reasons = result.skipped.filter((s: any) => s.reason !== "Sudah ada jurnal")
                    if (reasons.length > 0) {
                        toast.warning(`${reasons.length} aset dilewati: ${reasons.slice(0, 2).map((s: any) => `${s.assetCode} (${s.reason})`).join("; ")}`)
                    }
                }
            },
            onError: () => toast.error("Gagal menjalankan sinkronisasi COA"),
        })
    }

    const { data, isLoading } = useFixedAssets({
        search: search || undefined,
        status: statusFilter || undefined,
        categoryId: categoryFilter || undefined,
    })
    const { data: catData } = useFixedAssetCategories()

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-orange-400" />

    const { assets, summary } = data

    const kpis = [
        { label: "Total Aset", value: String(summary.totalAssets), dot: "bg-orange-500" },
        { label: "Aktif", value: String(summary.activeCount), dot: "bg-emerald-500" },
        { label: "Harga Perolehan", value: formatCurrency(summary.totalCost), dot: "bg-blue-500" },
        { label: "Akum. Penyusutan", value: formatCurrency(summary.totalAccDep), dot: "bg-amber-500" },
        { label: "Nilai Buku Bersih", value: formatCurrency(summary.totalNBV), dot: "bg-indigo-500" },
    ]

    return (
        <motion.div className="mf-page" variants={stagger} initial="hidden" animate="show">
            {/* ─── Unified Page Header ─── */}
            <motion.div variants={fadeUp} className={NB.pageCard}>
                <div className={NB.pageAccent} />

                {/* Row 1: Title + Actions */}
                <div className={`px-5 py-3.5 flex items-center justify-between ${NB.pageRowBorder}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-orange-500 flex items-center justify-center">
                            <Building className="h-4.5 w-4.5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                                Daftar Aset Tetap
                            </h1>
                            <p className="text-zinc-400 text-[11px] font-medium">
                                Kelola aset tetap perusahaan dan penyusutannya
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-0">
                        <Link href="/finance/fixed-assets/settings">
                            <Button variant="outline" className={NB.toolbarBtn + " " + NB.toolbarBtnJoin}>
                                <Settings className="h-3.5 w-3.5 mr-1.5" /> Pengaturan
                            </Button>
                        </Link>
                        <Link href="/finance/fixed-assets/categories">
                            <Button variant="outline" className={NB.toolbarBtn + " " + NB.toolbarBtnJoin}>
                                <FolderTree className="h-3.5 w-3.5 mr-1.5" /> Kategori
                            </Button>
                        </Link>
                        <Link href="/finance/fixed-assets/depreciation">
                            <Button variant="outline" className={NB.toolbarBtn + " " + NB.toolbarBtnJoin}>
                                <Calculator className="h-3.5 w-3.5 mr-1.5" /> Penyusutan
                            </Button>
                        </Link>
                        <Link href="/finance/fixed-assets/reports">
                            <Button variant="outline" className={NB.toolbarBtn + " " + NB.toolbarBtnJoin}>
                                <FileBarChart className="h-3.5 w-3.5 mr-1.5" /> Laporan
                            </Button>
                        </Link>
                        <Button
                            variant="outline"
                            onClick={handleBackfill}
                            disabled={backfillMutation.isPending}
                            className={NB.toolbarBtn}
                            title="Posting saldo awal aset tetap ke Chart of Accounts"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${backfillMutation.isPending ? "animate-spin" : ""}`} /> Sinkron COA
                        </Button>
                        <Button onClick={() => setCreateOpen(true)} className={NB.toolbarBtnPrimary}>
                            <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah Aset
                        </Button>
                    </div>
                </div>

                {/* Row 2: KPI Strip */}
                <div className={`${NB.kpiStrip} ${NB.pageRowBorder}`}>
                    {kpis.map((kpi) => (
                        <div key={kpi.label} className={NB.kpiCell}>
                            <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 ${kpi.dot}`} />
                                <span className={NB.kpiLabel}>{kpi.label}</span>
                            </div>
                            <motion.span
                                key={kpi.value}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring" as const, stiffness: 400, damping: 20 }}
                                className={kpi.label === "Total Aset" || kpi.label === "Aktif" ? NB.kpiCount : NB.kpiAmount}
                            >
                                {kpi.value}
                            </motion.span>
                        </div>
                    ))}
                </div>

                {/* Row 3: Filter Toolbar */}
                <div className={NB.filterBar}>
                    <div className="flex items-center gap-0">
                        <div className="relative">
                            <Search className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 z-10 transition-colors ${
                                search ? NB.inputIconActive : NB.inputIconEmpty
                            }`} />
                            <input
                                className={`${NB.filterInput} w-[280px] ${search ? NB.inputActive : NB.inputEmpty}`}
                                placeholder="Cari nama, kode, atau nomor seri..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-colors z-10"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                        <CheckboxFilter
                            label="Status"
                            hideLabel
                            triggerClassName={NB.filterDropdown}
                            triggerActiveClassName={NB.filterDropdown.replace("border-zinc-300 dark:border-zinc-700", "border-orange-400 dark:border-orange-500") + " bg-orange-50/50 dark:bg-orange-950/20"}
                            options={[
                                { value: "ACTIVE", label: "Aktif" },
                                { value: "FULLY_DEPRECIATED", label: "Disusutkan Penuh" },
                                { value: "DISPOSED", label: "Dihapus" },
                                { value: "SOLD", label: "Dijual" },
                                { value: "WRITTEN_OFF", label: "Dihapusbukukan" },
                            ]}
                            selected={statusFilter ? [statusFilter] : []}
                            onChange={(vals) => setStatusFilter(vals[0] || "")}
                        />
                        <CheckboxFilter
                            label="Kategori"
                            hideLabel
                            triggerClassName={NB.filterDropdown.replace("border-r-0", "")}
                            triggerActiveClassName={NB.filterDropdown.replace("border-r-0", "").replace("border-zinc-300 dark:border-zinc-700", "border-orange-400 dark:border-orange-500") + " bg-orange-50/50 dark:bg-orange-950/20"}
                            options={(catData?.categories || []).map((c: any) => ({ value: c.id, label: c.name }))}
                            selected={categoryFilter ? [categoryFilter] : []}
                            onChange={(vals) => setCategoryFilter(vals[0] || "")}
                        />
                    </div>
                    <span className="hidden md:inline text-[11px] font-medium text-zinc-400">
                        <span className="font-mono font-bold text-zinc-600 dark:text-zinc-300">{assets.length}</span> aset
                    </span>
                </div>
            </motion.div>

            {/* ─── Asset Table ─── */}
            <motion.div
                variants={fadeUp}
                className={NB.pageCard}
                style={{ minHeight: 400 }}
            >
                {/* Black header */}
                <div className="hidden md:grid grid-cols-[100px_1fr_120px_140px_140px_140px_100px_110px_80px] gap-2 px-5 py-2.5 bg-black dark:bg-zinc-950 border-b-2 border-black">
                    {["Kode", "Nama Aset", "Kategori", "Harga Perolehan", "Akum. Penyusutan", "Nilai Buku", "Metode", "Status", "Aksi"].map((h) => (
                        <span key={h} className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{h}</span>
                    ))}
                </div>

                {/* Table Body */}
                <div className="w-full flex-1 flex flex-col">
                    {assets.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: "spring" as const, stiffness: 300, damping: 25 }}
                            className="flex flex-col items-center justify-center py-16 text-zinc-400"
                        >
                            <div className="w-16 h-16 border-2 border-zinc-200 dark:border-zinc-700 flex items-center justify-center mb-4">
                                <Building className="h-7 w-7 text-zinc-200 dark:text-zinc-700" />
                            </div>
                            <span className="text-sm font-bold">Belum ada aset tetap</span>
                            <span className="text-xs text-zinc-400 mt-1">Klik &quot;Tambah Aset&quot; untuk mendaftarkan aset pertama</span>
                        </motion.div>
                    ) : (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {assets.map((asset: any, idx: number) => {
                                const status = statusLabels[asset.status] || statusLabels.DRAFT
                                return (
                                    <motion.div
                                        key={asset.id}
                                        custom={idx}
                                        variants={fadeX}
                                        initial="hidden"
                                        animate="show"
                                        transition={{ delay: idx * 0.03 }}
                                        className={`grid grid-cols-1 md:grid-cols-[100px_1fr_120px_140px_140px_140px_100px_110px_80px] gap-2 px-5 py-3 items-center transition-all hover:bg-orange-50/50 dark:hover:bg-orange-950/10 ${
                                            idx % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-zinc-50/60 dark:bg-zinc-800/20"
                                        }`}
                                    >
                                        <span className="font-mono text-sm font-black text-orange-600 dark:text-orange-400">{asset.assetCode}</span>
                                        <div>
                                            <span className="text-sm font-bold text-zinc-900 dark:text-white">{asset.name}</span>
                                            {asset.serialNumber && (
                                                <span className="text-[9px] text-zinc-400 font-mono block">SN: {asset.serialNumber}</span>
                                            )}
                                        </div>
                                        <span className="text-xs font-medium text-zinc-500">{asset.category?.name}</span>
                                        <span className="font-mono font-bold text-sm text-zinc-900 dark:text-white">{formatCurrency(Number(asset.purchaseCost))}</span>
                                        <span className="font-mono font-bold text-sm text-amber-600">{formatCurrency(Number(asset.accumulatedDepreciation))}</span>
                                        <span className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400">{formatCurrency(Number(asset.netBookValue))}</span>
                                        <span className="text-[10px] font-medium text-zinc-500">{methodLabels[asset.depreciationMethod]}</span>
                                        <span className={`inline-flex items-center w-fit text-[9px] font-black uppercase tracking-wide px-2 py-0.5 border rounded-none ${status.color}`}>
                                            {status.label}
                                        </span>
                                        <div>
                                            {(asset.status === "ACTIVE" || asset.status === "FULLY_DEPRECIATED") && (
                                                <motion.button
                                                    whileHover={{ y: -1 }}
                                                    whileTap={{ scale: 0.92 }}
                                                    onClick={() => setMovementAsset({
                                                        id: asset.id,
                                                        assetCode: asset.assetCode,
                                                        name: asset.name,
                                                        netBookValue: Number(asset.netBookValue),
                                                        location: asset.location,
                                                        department: asset.department,
                                                    })}
                                                    className="h-7 px-2 flex items-center gap-1 text-[9px] font-black uppercase border border-zinc-300 dark:border-zinc-600 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-400 transition-colors rounded-none"
                                                >
                                                    <ArrowRightLeft className="h-3 w-3" /> Aksi
                                                </motion.button>
                                            )}
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
                    <span className={NB.label + " !mb-0 !text-[10px]"}>{assets.length} aset</span>
                    <div />
                </div>
            </motion.div>

            <CreateAssetDialog open={createOpen} onOpenChange={setCreateOpen} />
            <AssetMovementDialog open={!!movementAsset} onOpenChange={(o) => !o && setMovementAsset(null)} asset={movementAsset} />
        </motion.div>
    )
}

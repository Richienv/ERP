"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
    BarChart3,
    Warehouse,
    ArrowRightLeft,
    ClipboardList,
    AlertTriangle,
    Tags,
    DollarSign,
    Package,
    ChevronRight,
    TrendingUp,
    Layers,
} from "lucide-react"
import { useProductsPage } from "@/hooks/use-products-query"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { formatIDR } from "@/lib/utils"

const reportCards = [
    {
        title: "Ringkasan Stok per Gudang",
        description: "Distribusi stok di setiap gudang",
        icon: Warehouse,
        color: "bg-blue-500",
        lightBg: "bg-blue-50",
        href: "/inventory/warehouses",
    },
    {
        title: "Pergerakan Stok",
        description: "Riwayat masuk, keluar, dan transfer",
        icon: ArrowRightLeft,
        color: "bg-emerald-500",
        lightBg: "bg-emerald-50",
        href: "/inventory/movements",
    },
    {
        title: "Stok Opname",
        description: "Hasil audit fisik vs sistem",
        icon: ClipboardList,
        color: "bg-violet-500",
        lightBg: "bg-violet-50",
        href: "/inventory/audit",
    },
    {
        title: "Peringatan Stok",
        description: "Produk dengan stok rendah atau kritis",
        icon: AlertTriangle,
        color: "bg-red-500",
        lightBg: "bg-red-50",
        href: "/inventory/alerts",
    },
    {
        title: "Valuasi Inventori",
        description: "Nilai aset persediaan saat ini",
        icon: DollarSign,
        color: "bg-cyan-500",
        lightBg: "bg-cyan-50",
        href: "/inventory/stock",
    },
]

export default function InventoryReportsPage() {
    const { data, isLoading } = useProductsPage()

    const kpis = useMemo(() => {
        if (!data) return null
        const products = data.products as any[]
        const warehouses = data.warehouses as any[]

        const totalProduk = products.length
        const totalNilai = products.reduce(
            (sum: number, p: any) => sum + (p.currentStock ?? 0) * (p.costPrice ?? 0),
            0
        )
        const rataStok =
            totalProduk > 0
                ? Math.round(
                      products.reduce((sum: number, p: any) => sum + (p.currentStock ?? 0), 0) /
                          totalProduk
                  )
                : 0
        const gudangAktif = warehouses.length

        return { totalProduk, totalNilai, rataStok, gudangAktif }
    }, [data])

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-cyan-400" />

    return (
        <div className="mf-page">
            {/* ═══════════════════════════════════════════ */}
            {/* COMMAND HEADER                              */}
            {/* ═══════════════════════════════════════════ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-cyan-400">
                    <div className="flex items-center gap-3">
                        <BarChart3 className="h-5 w-5 text-cyan-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Laporan Inventori
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Ringkasan dan analisis data persediaan
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* KPI PULSE STRIP                            */}
            {/* ═══════════════════════════════════════════ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    {/* Total Produk */}
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-cyan-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Package className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                Total Produk
                            </span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">
                            {kpis?.totalProduk ?? "—"}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-cyan-600">Semua SKU terdaftar</span>
                        </div>
                    </div>

                    {/* Total Nilai */}
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                Total Nilai
                            </span>
                        </div>
                        <div className="text-lg md:text-xl font-black tracking-tighter text-zinc-900 dark:text-white">
                            {kpis ? formatIDR(kpis.totalNilai) : "—"}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-emerald-600">Valuasi persediaan</span>
                        </div>
                    </div>

                    {/* Rata-rata Stok */}
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-violet-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                Rata-rata Stok
                            </span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">
                            {kpis?.rataStok ?? "—"}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-violet-600">Unit per produk</span>
                        </div>
                    </div>

                    {/* Gudang Aktif */}
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Layers className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                Gudang Aktif
                            </span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">
                            {kpis?.gudangAktif ?? "—"}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-amber-600">Lokasi penyimpanan</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* REPORT CARDS GRID                          */}
            {/* ═══════════════════════════════════════════ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reportCards.map((report) => {
                    const Icon = report.icon
                    return (
                        <Link
                            key={report.href}
                            href={report.href}
                            className="group border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all bg-white dark:bg-zinc-900"
                        >
                            <div className="p-5 flex items-center gap-4">
                                <div
                                    className={`${report.color} h-12 w-12 flex items-center justify-center flex-shrink-0`}
                                >
                                    <Icon className="h-6 w-6 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-black uppercase tracking-tight text-zinc-900 dark:text-white text-sm">
                                        {report.title}
                                    </h3>
                                    <p className="text-xs text-zinc-500 mt-0.5">
                                        {report.description}
                                    </p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-zinc-300 group-hover:text-zinc-600 transition-colors flex-shrink-0" />
                            </div>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}

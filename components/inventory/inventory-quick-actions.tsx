"use client"

import { BentoLauncher, BentoLauncherItem } from "@/components/dashboard/bento-launcher"
import { Package, ClipboardList, ArrowRightLeft, AlertTriangle, Layers, BarChart } from "lucide-react"

const inventoryModules: BentoLauncherItem[] = [
    {
        title: "Kelola Produk",
        href: "/inventory/products",
        icon: Package,
        color: "text-emerald-500",
        description: "Katalog, Harga, Varian"
    },
    {
        title: "Level Stok",
        href: "/inventory/stock",
        icon: Layers,
        color: "text-blue-500",
        description: "Jumlah Saat Ini, Status Gudang"
    },
    {
        title: "Pergerakan Stok",
        href: "/inventory/movements",
        icon: ArrowRightLeft,
        color: "text-purple-500",
        description: "Masuk, Keluar, Riwayat Transfer"
    },
    {
        title: "Audit Stok",
        href: "/inventory/audit",
        icon: ClipboardList,
        color: "text-orange-500",
        description: "Stok Opname & Penyesuaian"
    },
    {
        title: "Peringatan Stok",
        href: "/inventory/alerts",
        icon: AlertTriangle,
        color: "text-rose-500",
        description: "Peringatan Level Kritis"
    },
    {
        title: "Laporan Gudang",
        href: "/inventory/reports",
        icon: BarChart,
        color: "text-cyan-500",
        description: "Valuasi & Analisis Perputaran"
    },
]

export function InventoryQuickActions() {
    return (
        <section className="bg-white p-6 rounded-xl border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] border-t-4 border-t-black">
            <h2 className="text-xl font-black mb-6 text-foreground uppercase tracking-tight flex items-center gap-2">
                ⚡ Akses Cepat (Quick Modules)
            </h2>
            <BentoLauncher items={inventoryModules} columns={3} />
        </section>
    )
}

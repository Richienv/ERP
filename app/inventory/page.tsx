"use client"

import { BentoLauncher, BentoLauncherItem } from "@/components/dashboard/bento-launcher"
import { Package, ClipboardList, ArrowRightLeft, AlertTriangle, Layers, BarChart, Settings2, Zap, Siren } from "lucide-react"
import { GlobalKPIs } from "@/components/inventory/global-kpis"
import { WarehouseCard } from "@/components/inventory/warehouse-card"
import { PerformanceCharts } from "@/components/inventory/performance-charts"
import { Button } from "@/components/ui/button"
import { DetailedMaterialTable } from "@/components/inventory/detailed-material-table"

// Inventory Sub-Modules
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

export default function InventoryPage() {
  return (
    <div className="min-h-[calc(100vh-theme(spacing.16))] w-full bg-background p-4 md:p-8 font-sans transition-colors duration-300">
      <div className="max-w-7xl mx-auto space-y-8 pb-20">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-foreground tracking-tighter uppercase mb-2 flex items-center gap-3">
              Manajemen Logistik <span className="bg-black text-white text-xs px-2 py-1 rounded-full animate-pulse flex items-center gap-1"><Siren className="h-3 w-3 text-red-500" /> LIVE MODE</span>
            </h1>
            <p className="text-muted-foreground font-bold text-lg">Command Center operasional gudang & pemantauan real-time.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-10 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] transition-all">
              <Settings2 className="mr-2 h-4 w-4" /> Config
            </Button>
            <Button className="h-10 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-black text-white font-black hover:bg-zinc-800 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] transition-all">
              <Zap className="mr-2 h-4 w-4 text-yellow-400" /> Auto-Report
            </Button>
          </div>
        </div>

        {/* 1. Global KPIs (Action Command) */}
        <section>
          <GlobalKPIs />
          <DetailedMaterialTable />
        </section>

        {/* 2. Quick Actions (Bento Launcher) */}
        <section className="bg-white p-6 rounded-xl border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="text-xl font-black mb-6 text-foreground uppercase tracking-tight flex items-center gap-2">
            ⚡ Modul Cepat
          </h2>
          <BentoLauncher items={inventoryModules} columns={3} />
        </section>

        {/* 3. Per-Warehouse Activity (Cards) with NEW LOGIC */}
        <section>
          <h2 className="text-xl font-black mb-6 text-foreground uppercase tracking-tight">Status Operasional Gudang (Real-time)</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <WarehouseCard
              name="Gudang A - Bahan Baku"
              manager="Budi Santoso"
              staffActive={24}
              pickingRate={450}
              targetRate={400} // Overachieving!
              dockStatus="BUSY"
              zoneUsageA={85}
              zoneUsageB={40}
              packingBacklog={12}
            />
            <WarehouseCard
              name="Gudang B - Barang Jadi"
              manager="Siti Aminah"
              staffActive={32}
              pickingRate={210}
              targetRate={350} // Critical Underperformance
              dockStatus="CONGESTED" // Problem
              zoneUsageA={95} // Full
              zoneUsageB={92} // Full
              packingBacklog={68}
            />
            <WarehouseCard
              name="Gudang C - Distribusi"
              manager="Rudi Hartono"
              staffActive={18}
              pickingRate={180}
              targetRate={200}
              dockStatus="IDLE"
              zoneUsageA={30}
              zoneUsageB={20}
              packingBacklog={2}
            />
          </div>
        </section>

        {/* 4. Performance Section */}
        <section>
          <h2 className="text-xl font-black mb-6 text-foreground uppercase tracking-tight">Analisis Prediktif & Biaya</h2>
          <PerformanceCharts />
        </section>

      </div>
    </div>
  )
}
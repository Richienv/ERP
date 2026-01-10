"use client"

import { BentoLauncher, BentoLauncherItem } from "@/components/dashboard/bento-launcher"
import { Package, ClipboardList, ArrowRightLeft, AlertTriangle, Layers, BarChart, Settings2 } from "lucide-react"
import { GlobalKPIs } from "@/components/inventory/global-kpis"
import { WarehouseCard } from "@/components/inventory/warehouse-card"
import { PerformanceCharts } from "@/components/inventory/performance-charts"
import { Button } from "@/components/ui/button"
import { DetailedMaterialTable } from "@/components/inventory/detailed-material-table" // NEW

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
            <h1 className="text-3xl font-medium text-foreground font-serif tracking-tight">Manajemen Gudang</h1>
            <p className="text-muted-foreground mt-1">Overview operasional dan kesehatan stok gudang harian.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Settings2 className="mr-2 h-4 w-4" /> Konfigurasi
            </Button>
            <Button size="sm">
              Laporan Harian
            </Button>
          </div>
        </div>

        {/* 1. Global KPIs */}
        <section>
          <GlobalKPIs />
          <DetailedMaterialTable />
        </section>

        {/* 2. Quick Actions (Bento Launcher) */}
        <section className="bg-secondary/20 p-6 rounded-3xl border border-border/50">
          <h2 className="text-lg font-semibold mb-4 text-foreground">Aksi Cepat & Modul</h2>
          <BentoLauncher items={inventoryModules} columns={3} />
        </section>

        {/* 3. Per-Warehouse Activity (Cards) */}
        <section>
          <h2 className="text-xl font-semibold mb-4 text-foreground">Status Gudang</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <WarehouseCard
              name="Gudang A - Bahan Baku"
              manager="Budi Santoso"
              staffActive={24}
              tasksPending={12}
              ordersToPick={45}
              ordersShipped={120}
              receiptsOpen={5}
              stockAccuracy={99.2}
              lowStockItems={3}
              capacity={85}
            />
            <WarehouseCard
              name="Gudang B - Barang Jadi"
              manager="Siti Aminah"
              staffActive={32}
              tasksPending={68}
              ordersToPick={150}
              ordersShipped={310}
              receiptsOpen={12}
              stockAccuracy={98.5}
              lowStockItems={0}
              capacity={65}
            />
            <WarehouseCard
              name="Gudang C - Distribusi"
              manager="Rudi Hartono"
              staffActive={18}
              tasksPending={8}
              ordersToPick={20}
              ordersShipped={85}
              receiptsOpen={2}
              stockAccuracy={99.8}
              lowStockItems={1}
              capacity={40}
            />
          </div>
        </section>

        {/* 4. Performance Section */}
        <section>
          <h2 className="text-xl font-semibold mb-4 text-foreground">Analisis Performa</h2>
          <PerformanceCharts />
        </section>

      </div>
    </div>
  )
}
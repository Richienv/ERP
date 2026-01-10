"use client";

import { useState } from "react"

import { MorningFocus } from "@/components/dashboard/morning-focus"
import { InfiniteBackground } from "@/components/dashboard/infinite-background" // RESTORED
import { motion } from "framer-motion" // RESTORED
import { ProductionLineStatus } from "@/components/manager/production-line-status" // RESTORED

import { FinanceSnapshot } from "@/components/dashboard/finance-snapshot"
import { ExecutiveAlerts } from "@/components/dashboard/executive-alerts"
import { ExecutiveKPIs } from "@/components/dashboard/executive-kpis"
import { RitchieActivityFeed } from "@/components/dashboard/ritchie-activity-feed"
import { MaterialTrackingCard } from "@/components/manager/material-tracking-card"
import { QualityTrackingCard } from "@/components/manager/quality-tracking-card"
import { RitchieSDMCard } from "@/components/dashboard/ritchie-sdm-card"
import { BentoLauncher, BentoLauncherItem } from "@/components/dashboard/bento-launcher"
import { AiSearchCard } from "@/components/dashboard/ai-search-card"
import { Users, FileText, ShoppingCart, Factory, PieChart, Truck, File, Briefcase, ChevronsUp, ChevronsDown, Package } from "lucide-react"

// Main System Modules for the Launcher
const mainModules: BentoLauncherItem[] = [
  { title: "Gudang", href: "/inventory", icon: Package, color: "text-emerald-500", description: "Stok, Produk, Pergerakan" },
  { title: "Penjualan", href: "/sales", icon: ShoppingCart, color: "text-blue-500", description: "Pesanan, Pelanggan, Kasir" },
  { title: "Keuangan", href: "/finance", icon: FileText, color: "text-purple-500", description: "Faktur, Pengeluaran, Laporan" },
  { title: "Pengadaan", href: "/procurement", icon: Truck, color: "text-amber-500", description: "Supplier, PO, Pembelian" },
  { title: "Manufaktur", href: "/manufacturing", icon: Factory, color: "text-orange-500", description: "Pekerjaan, Pelacakan, Kualitas" },
  { title: "CRM", href: "/crm", icon: Users, color: "text-pink-500", description: "Prospek, Klien, Dukungan" },
  { title: "SDM", href: "/hcm", icon: Briefcase, color: "text-indigo-500", description: "Karyawan, Presensi, Gaji" },
  { title: "Laporan", href: "/reports", icon: PieChart, color: "text-cyan-500", description: "Analitik & Wawasan" },
  { title: "Dokumen", href: "/documents", icon: File, color: "text-slate-500", description: "Arsip, Kontrak, SOP" },
]

export default function DashboardPage() {
  const [isCompact, setCompact] = useState(false)
  return (
    <div className="relative min-h-[calc(100vh-theme(spacing.16))] w-full bg-zinc-50 dark:bg-black font-sans selection:bg-zinc-200 dark:selection:bg-zinc-800">

      {/* 1. Infinite Background Layer */}
      <InfiniteBackground />

      {/* 2. Scrollable Content Layer */}
      <div className="relative z-10 container mx-auto p-4 md:p-8 space-y-8">

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-6 auto-rows-min">

          {/* 1. Morning Focus (Top Left) - 3x2 */}
          <motion.div
            className="md:col-span-3 md:row-span-2"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <MorningFocus />
          </motion.div>

          {/* 2. AI Search Action (Top Right) - 3x2 */}
          <motion.div
            className="md:col-span-3 md:row-span-2 h-full"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.05 }}
          >
            <AiSearchCard />
          </motion.div>

          {/* 3. NEW: Financial Health Snapshot (Full Width) */}
          <motion.div
            className="md:col-span-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <FinanceSnapshot />
          </motion.div>

          {/* 4. NEW: Operational KPIs (Full Width) */}
          <motion.div
            className="md:col-span-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <ExecutiveKPIs />
          </motion.div>


          {/* 5. Main Application Launcher */}
          <div className="md:col-span-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-serif font-medium text-zinc-900 dark:text-white flex items-center gap-2">
                <span className="w-1 h-6 bg-indigo-500 rounded-full"></span>
                Aplikasi
              </h2>
              <button
                onClick={() => setCompact(!isCompact)}
                className="p-1.5 hover:bg-muted rounded-md text-muted-foreground transition-colors"
              >
                {isCompact ? <ChevronsDown size={20} /> : <ChevronsUp size={20} />}
              </button>
            </div>
            <BentoLauncher items={mainModules} columns={3} compact={isCompact} />
          </div>


          {/* 6. ProductionLineStatus (Physical Stations) + Critical Alerts Row */}
          <motion.div
            className="md:col-span-4 min-h-[400px]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
          >
            <ProductionLineStatus />
          </motion.div>

          <motion.div
            className="md:col-span-2 min-h-[400px]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <ExecutiveAlerts />
          </motion.div>



          {/* 7. Bottom 4 Cards Grid - Ritchie Minimal Style */}
          <motion.div
            className="md:col-span-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35 }}
          >
            {/* Activity Feed */}
            <div className="col-span-1 min-h-[400px]">
              <RitchieActivityFeed />
            </div>

            {/* Material Tracking */}
            <div className="col-span-1 min-h-[400px]">
              <MaterialTrackingCard />
            </div>

            {/* Quality Tracking */}
            <div className="col-span-1 min-h-[400px]">
              <QualityTrackingCard />
            </div>

            {/* SDM / HR */}
            <div className="col-span-1 min-h-[400px]">
              <RitchieSDMCard />
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  )
}

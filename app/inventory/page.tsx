import { Suspense } from "react"
import { InventoryQuickActions } from "@/components/inventory/inventory-quick-actions"
import { GlobalKPIs } from "@/components/inventory/global-kpis"
import { WarehouseCard } from "@/components/inventory/warehouse-card"
import { ProcurementInsights } from "@/components/inventory/procurement-insights"
import { MaterialInputForm } from "@/components/inventory/material-input-form"
import { MaterialTableWrapper } from "@/components/inventory/material-table-wrapper"
import { 
    KPISkeleton, 
    MaterialTableSkeleton, 
    ProcurementInsightsSkeleton 
} from "@/components/inventory/inventory-skeletons"
import { InventoryPerformanceProvider } from "@/components/inventory/inventory-performance-provider"

export default async function InventoryPage() {
  return (
    <InventoryPerformanceProvider currentPath="/inventory">
      <div className="min-h-[calc(100vh-theme(spacing.16))] w-full bg-background p-4 md:p-8 font-sans transition-colors duration-300">
        <div className="max-w-7xl mx-auto space-y-8 pb-20">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black text-foreground tracking-tighter uppercase mb-2 flex items-center gap-3">
                Manajemen Logistik
              </h1>
              <p className="text-muted-foreground font-bold text-lg">Command Center operasional gudang & pemantauan real-time.</p>
            </div>

            <div className="flex gap-2">
              <MaterialInputForm />
            </div>
          </div>

        {/* 1. Global KPIs (Action Command) */}
        <section>
          <Suspense fallback={<KPISkeleton />}>
            <GlobalKPIs />
          </Suspense>
          <Suspense fallback={<MaterialTableSkeleton />}>
            <MaterialTableWrapper />
          </Suspense>
        </section>

        {/* 2. Procurement Insights (Data Driven) */}
        <section>
          <Suspense fallback={<ProcurementInsightsSkeleton />}>
            <ProcurementInsights />
          </Suspense>
        </section>

        {/* 3. Per-Warehouse Activity (Cards) */}
        <section>
          <h2 className="text-xl font-black mb-6 text-foreground uppercase tracking-tight">Status Operasional Gudang (Real-time)</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <WarehouseCard
              id="17748eec-45a0-4512-951b-c59113bc5c26"
              name="Gudang A - Bahan Baku"
              manager="Budi Santoso"
              staffActive={24}
              dockStatus="BUSY"
              inventoryValue={4500000000} // 4.5 Miliar
              depreciationValue={125000000} // 125 Juta
              activePOs={8}
              activeTasks={142}
            />
            <WarehouseCard
              id="17748eec-45a0-4512-951b-c59113bc5c26" // Reusing ID for demo/mock as not fetched dynamically here yet
              name="Gudang B - Barang Jadi"
              manager="Siti Aminah"
              staffActive={32}
              dockStatus="CONGESTED"
              inventoryValue={8200000000} // 8.2 Miliar
              depreciationValue={45000000} // 45 Juta
              activePOs={3}
              activeTasks={85}
            />
            <WarehouseCard
              id="17748eec-45a0-4512-951b-c59113bc5c26"
              name="Gudang C - Distribusi"
              manager="Rudi Hartono"
              staffActive={18}
              dockStatus="IDLE"
              inventoryValue={1200000000} // 1.2 Miliar
              depreciationValue={12000000} // 12 Juta
              activePOs={12}
              activeTasks={210}
            />
          </div>
        </section>

          {/* 4. Quick Actions (Moved to Bottom) */}
          <InventoryQuickActions />
        </div>
      </div>
    </InventoryPerformanceProvider>
  )
}
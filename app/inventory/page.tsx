export const dynamic = 'force-dynamic'

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
import { getWarehouses } from "@/app/actions/inventory"

export default async function InventoryPage() {
  const warehouses = await getWarehouses()
  const liveWarehouses = warehouses.slice(0, 3)

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
              {liveWarehouses.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
                  Belum ada data gudang aktif.
                </div>
              ) : (
                liveWarehouses.map((warehouse) => {
                  const dockStatus = warehouse.utilization >= 90 ? "CONGESTED" : warehouse.utilization >= 60 ? "BUSY" : "IDLE"
                  return (
                    <WarehouseCard
                      key={warehouse.id}
                      id={warehouse.id}
                      name={`${warehouse.code} - ${warehouse.name}`}
                      manager={warehouse.manager || "Unassigned"}
                      staffActive={warehouse.staff || 0}
                      dockStatus={dockStatus}
                      inventoryValue={warehouse.totalValue || 0}
                      depreciationValue={Math.round((warehouse.totalValue || 0) * 0.03)}
                      activePOs={warehouse.activePOs || 0}
                      activeTasks={warehouse.pendingTasks || 0}
                    />
                  )
                })
              )}
            </div>
          </section>

          {/* 4. Quick Actions (Moved to Bottom) */}
          <InventoryQuickActions />
        </div>
      </div>
    </InventoryPerformanceProvider>
  )
}

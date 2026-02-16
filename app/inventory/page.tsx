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
import { InventoryDashboardView } from "@/components/inventory/inventory-dashboard-view"

export default async function InventoryPage() {
  const warehouses = await getWarehouses()
  const liveWarehouses = warehouses.slice(0, 3)

  return (
    <InventoryPerformanceProvider currentPath="/inventory">
      <InventoryDashboardView
        /* Row 1: Header */
        headerSlot={
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white tracking-tighter uppercase flex items-center gap-2">
                📦 Logistik Command Center
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mt-0.5">Real-time warehouse &amp; inventory monitoring</p>
            </div>
            <div className="flex gap-2">
              <MaterialInputForm />
            </div>
          </div>
        }

        /* Row 2: KPI PulseBar */
        pulseBarSlot={
          <Suspense fallback={<KPISkeleton />}>
            <GlobalKPIs />
          </Suspense>
        }

        /* Row 3: Main Content — Material Table (left) + Warehouses (right) */
        mainLeftSlot={
          <Suspense fallback={<MaterialTableSkeleton />}>
            <MaterialTableWrapper />
          </Suspense>
        }

        mainRightSlot={
          <div className="flex flex-col gap-2 h-full overflow-y-auto p-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">
              Gudang Aktif
            </div>
            {liveWarehouses.length === 0 ? (
              <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 text-xs text-zinc-500 font-bold text-center">
                Belum ada gudang aktif.
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
                    capacityPercent={warehouse.utilization || 0}
                  />
                )
              })
            )}
          </div>
        }

        /* Row 4: Bottom — Quick Actions + Procurement */
        bottomLeftSlot={
          <InventoryQuickActions />
        }

        bottomRightSlot={
          <Suspense fallback={<ProcurementInsightsSkeleton />}>
            <ProcurementInsights />
          </Suspense>
        }
      />
    </InventoryPerformanceProvider>
  )
}

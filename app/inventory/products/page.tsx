export const dynamic = 'force-dynamic'

import { getProductsForKanban, getCategories, getWarehouses } from '@/app/actions/inventory'
import { getVendors } from '@/app/actions/vendor'
import { InventoryKanbanBoard } from '@/components/inventory/inventory-kanban-board'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Plus, SlidersHorizontal } from 'lucide-react'
import { ProductDataTable } from '@/components/inventory/product-data-table'
import { ProductCreateDialog } from '@/components/inventory/product-create-dialog'
import { InventoryPerformanceProvider } from '@/components/inventory/inventory-performance-provider'

export default async function InventoryProductsPage() {
  const [products, categories, warehouses] = await Promise.all([
    getProductsForKanban(),
    getCategories(),
    getWarehouses()
  ])

  return (
    <InventoryPerformanceProvider currentPath="/inventory/products">
      <div className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory Command Center</h1>
            <p className="text-slate-500">Monitor stock health, values, and replenishment needs.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <SlidersHorizontal className="mr-2 h-4 w-4" /> Filter
            </Button>
            <ProductCreateDialog categories={categories} />
          </div>
        </div>



        <Tabs defaultValue="kanban" className="w-full">
          <TabsList className="mb-4 bg-white border">
            <TabsTrigger value="kanban">Kanban View</TabsTrigger>
            <TabsTrigger value="list">Detailed List</TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="mt-0">
            <InventoryKanbanBoard products={products} warehouses={warehouses} categories={categories} />
          </TabsContent>

          <TabsContent value="list" className="mt-0">
            <div className="bg-white rounded-lg border p-4">
              <ProductDataTable data={products} categories={categories} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </InventoryPerformanceProvider>
  )
}
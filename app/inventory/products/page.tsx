export const dynamic = 'force-dynamic'

import { getProductsForKanban, getCategories, getWarehouses } from '@/app/actions/inventory'
import { Button } from '@/components/ui/button'
import { SlidersHorizontal } from 'lucide-react'
import { ProductCreateDialog } from '@/components/inventory/product-create-dialog'
import { InventoryPerformanceProvider } from '@/components/inventory/inventory-performance-provider'
import { InventoryProductsTabs } from '@/components/inventory/inventory-products-tabs'

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



        <InventoryProductsTabs initialProducts={products} warehouses={warehouses} />
      </div>
    </InventoryPerformanceProvider>
  )
}

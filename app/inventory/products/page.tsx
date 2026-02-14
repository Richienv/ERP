export const dynamic = 'force-dynamic'

import { getProductsForKanban, getCategories, getWarehouses } from '@/app/actions/inventory'
import { InventoryKanbanBoard } from '@/components/inventory/inventory-kanban-board'
import { ProductDataTable } from '@/components/inventory/product-data-table'
import { ProductCreateDialog } from '@/components/inventory/product-create-dialog'
import { InventoryPerformanceProvider } from '@/components/inventory/inventory-performance-provider'
import { ProductsPageClient } from './products-client'

/** Race a promise against a timeout — returns fallback on timeout */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
  ])
}

export default async function InventoryProductsPage() {
  const [products, categories, warehouses] = await Promise.all([
    withTimeout(getProductsForKanban(), 8000, []),
    withTimeout(getCategories(), 5000, []),
    withTimeout(getWarehouses(), 5000, []),
  ])

  // Compute stats from products
  const stats = {
    total: products.length,
    healthy: products.filter((p: any) => p.status === 'HEALTHY').length,
    lowStock: products.filter((p: any) => p.status === 'LOW_STOCK').length,
    critical: products.filter((p: any) => p.status === 'CRITICAL' || p.manualAlert).length,
    totalValue: products.reduce((sum: number, p: any) => sum + ((p.totalStock || 0) * (p.costPrice || 0)), 0),
  }

  return (
    <InventoryPerformanceProvider currentPath="/inventory/products">
      <ProductsPageClient
        products={products}
        categories={categories}
        warehouses={warehouses}
        stats={stats}
      />
    </InventoryPerformanceProvider>
  )
}

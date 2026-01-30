
import { getProductsForKanban } from '@/app/actions/inventory'
import { InventoryKanbanBoard } from '@/components/inventory/inventory-kanban-board'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Plus, SlidersHorizontal } from 'lucide-react'
import { ProductDataTable } from '@/components/inventory/product-data-table' // Assuming this exists from previous structure

export default async function InventoryProductsPage() {
  const products = await getProductsForKanban()

  return (
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
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Product
          </Button>
        </div>
      </div>



      <Tabs defaultValue="kanban" className="w-full">
        <TabsList className="mb-4 bg-white border">
          <TabsTrigger value="kanban">Kanban View</TabsTrigger>
          <TabsTrigger value="list">Detailed List</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-0">
          <InventoryKanbanBoard products={products} />
        </TabsContent>

        <TabsContent value="list" className="mt-0">
          <div className="bg-white rounded-lg border p-4">
            <ProductDataTable data={products.map(p => ({
              id: p.id,
              code: p.code,
              name: p.name,
              description: '',
              categoryId: '',
              category: { name: p.category, id: '', code: '', description: '', parentId: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
              unit: p.unit,
              costPrice: 0,
              sellingPrice: 0,
              minStock: p.minStock,
              maxStock: 0,
              reorderLevel: 0,
              barcode: null,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
              _count: { stockLevels: 1, transactions: 0 },
              currentStock: p.totalStock
            }))} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
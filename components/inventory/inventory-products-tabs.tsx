"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InventoryKanbanBoard } from "@/components/inventory/inventory-kanban-board"
import { ProductDataTable } from "@/components/inventory/product-data-table"

interface InventoryProductsTabsProps {
  initialProducts: any[]
  warehouses: { id: string; name: string }[]
}

export function InventoryProductsTabs({ initialProducts, warehouses }: InventoryProductsTabsProps) {
  const [products, setProducts] = useState<any[]>(initialProducts)

  useEffect(() => {
    setProducts(initialProducts)
  }, [initialProducts])

  return (
    <Tabs defaultValue="kanban" className="w-full">
      <TabsList className="mb-4 bg-white border">
        <TabsTrigger value="kanban">Kanban View</TabsTrigger>
        <TabsTrigger value="list">Detailed List</TabsTrigger>
      </TabsList>

      <TabsContent value="kanban" className="mt-0">
        <InventoryKanbanBoard products={products} warehouses={warehouses} onProductsChange={setProducts} />
      </TabsContent>

      <TabsContent value="list" className="mt-0">
        <div className="bg-white rounded-lg border p-4">
          <ProductDataTable data={products} />
        </div>
      </TabsContent>
    </Tabs>
  )
}

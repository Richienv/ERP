"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InventoryKanbanBoard } from "@/components/inventory/inventory-kanban-board"
import { ProductDataTable } from "@/components/inventory/product-data-table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Search } from "lucide-react"

interface InventoryProductsTabsProps {
  initialProducts: any[]
  warehouses: { id: string; name: string }[]
  initialQuery: { q: string | null; status: string | null }
  initialSummary: { total: number; healthy: number; lowStock: number; critical: number; newItems: number }
}

export function InventoryProductsTabs({ initialProducts, warehouses, initialQuery, initialSummary }: InventoryProductsTabsProps) {
  const [products, setProducts] = useState<any[]>(initialProducts)
  const [searchText, setSearchText] = useState(initialQuery.q || "")
  const [statusFilter, setStatusFilter] = useState(initialQuery.status || "__all__")
  const [summary, setSummary] = useState(initialSummary)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  useEffect(() => {
    setProducts(initialProducts)
    setSearchText(initialQuery.q || "")
    setStatusFilter(initialQuery.status || "__all__")
    setSummary(initialSummary)
  }, [initialProducts, initialQuery, initialSummary])

  const applyServerFilters = () => {
    const params = new URLSearchParams(searchParams.toString())
    const normalizedQ = searchText.trim()
    if (normalizedQ) params.set("q", normalizedQ)
    else params.delete("q")

    if (statusFilter === "__all__") params.delete("status")
    else params.set("status", statusFilter)

    const queryString = params.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname)
  }

  const resetServerFilters = () => {
    setSearchText("")
    setStatusFilter("__all__")
    const params = new URLSearchParams(searchParams.toString())
    params.delete("q")
    params.delete("status")
    const queryString = params.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname)
  }

  useEffect(() => {
    const refreshFromServer = () => {
      if (document.visibilityState === "visible") {
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      }
    }

    const intervalId = window.setInterval(refreshFromServer, 12000)
    window.addEventListener("focus", refreshFromServer)
    document.addEventListener("visibilitychange", refreshFromServer)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("focus", refreshFromServer)
      document.removeEventListener("visibilitychange", refreshFromServer)
    }
  }, [queryClient])

  return (
    <Tabs defaultValue="kanban" className="w-full space-y-4">
      <div className="rounded-lg border bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[1.5fr_220px_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-zinc-400" />
            <Input
              className="pl-9"
              placeholder="Cari produk, kode, atau kategori..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Semua status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Semua Status</SelectItem>
              <SelectItem value="HEALTHY">Healthy</SelectItem>
              <SelectItem value="LOW_STOCK">Low Stock</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
              <SelectItem value="NEW">New</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="secondary" onClick={applyServerFilters}>
            Terapkan
          </Button>
          <Button variant="outline" onClick={resetServerFilters}>
            Reset
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">Total: {summary.total}</Badge>
          <Badge variant="outline">Healthy: {summary.healthy}</Badge>
          <Badge variant="outline">Low: {summary.lowStock}</Badge>
          <Badge variant="outline">Critical: {summary.critical}</Badge>
          <Badge variant="outline">New: {summary.newItems}</Badge>
          <Button variant="ghost" size="sm" className="ml-auto h-7 px-2" onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.products.all })}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Sync
          </Button>
        </div>
      </div>

      <TabsList className="mb-4 bg-white border">
        <TabsTrigger value="kanban">Kanban View</TabsTrigger>
        <TabsTrigger value="list">Detailed List</TabsTrigger>
      </TabsList>

      <TabsContent value="kanban" className="mt-0">
        <InventoryKanbanBoard products={products} warehouses={warehouses} />
      </TabsContent>

      <TabsContent value="list" className="mt-0">
        <div className="bg-white rounded-lg border p-4">
          <ProductDataTable data={products} />
        </div>
      </TabsContent>
    </Tabs>
  )
}

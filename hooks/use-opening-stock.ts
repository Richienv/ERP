"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

interface OpeningStockProduct {
    id: string
    code: string
    name: string
    unit: string
    costPrice: number
}

interface OpeningStockWarehouse {
    id: string
    code: string
    name: string
}

interface ExistingTransaction {
    id: string
    productId: string
    warehouseId: string
    quantity: number
    unitCost: number
    totalValue: number
    createdAt: string
    product: { code: string; name: string; unit: string }
    warehouse: { code: string; name: string }
}

interface OpeningStockData {
    products: OpeningStockProduct[]
    warehouses: OpeningStockWarehouse[]
    existingTransactions: ExistingTransaction[]
}

export function useOpeningStock() {
    return useQuery({
        queryKey: queryKeys.openingStock.list(),
        queryFn: async (): Promise<OpeningStockData> => {
            const res = await fetch("/api/inventory/opening-stock")
            const json = await res.json()
            if (!json.success) throw new Error(json.error || "Failed to fetch")
            return {
                products: json.products ?? [],
                warehouses: json.warehouses ?? [],
                existingTransactions: json.existingTransactions ?? [],
            }
        },
    })
}

interface OpeningStockItem {
    productId: string
    warehouseId: string
    quantity: number
    unitCost: number
}

export function useSubmitOpeningStock() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (items: OpeningStockItem[]) => {
            const res = await fetch("/api/inventory/opening-stock", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items }),
            })
            const json = await res.json()
            if (!res.ok || !json.success) {
                throw new Error(json.error || "Gagal menyimpan")
            }
            return json
        },
        onSuccess: () => {
            // Invalidate all related caches
            queryClient.invalidateQueries({ queryKey: queryKeys.openingStock.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.stockMovements.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all })
        },
    })
}

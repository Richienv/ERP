"use client"

import { useQuery } from "@tanstack/react-query"
import { getStockMovements } from "@/app/actions/inventory"

async function fetchProductsAndWarehouses() {
    const res = await fetch("/api/inventory/page-data")
    if (!res.ok) return { products: [], warehouses: [] }
    const json = await res.json()
    return { products: json.products ?? [], warehouses: json.warehouses ?? [] }
}

export function useStockMovements() {
    return useQuery({
        queryKey: ["stockMovements", "list"],
        queryFn: async () => {
            const [{ products, warehouses }, movements] = await Promise.all([
                fetchProductsAndWarehouses(),
                getStockMovements(100),
            ])
            return { movements, products, warehouses }
        },
    })
}

export function useAdjustmentsData() {
    return useQuery({
        queryKey: ["adjustments", "list"],
        queryFn: async () => {
            const [{ products, warehouses }, movements] = await Promise.all([
                fetchProductsAndWarehouses(),
                getStockMovements(50),
            ])
            return { products, warehouses, movements }
        },
    })
}

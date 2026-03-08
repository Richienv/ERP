"use client"

import { useQuery } from "@tanstack/react-query"
import { getVendors } from "@/lib/actions/procurement"
import { getWarehousesForGRN } from "@/lib/actions/grn"

/**
 * Fetches vendors, products, and warehouses needed for the Direct Purchase dialog.
 * Only fetches when the dialog is about to open (enabled flag).
 */
export function useDirectPurchaseOptions(enabled: boolean) {
    const vendors = useQuery({
        queryKey: ["directPurchase", "vendors"],
        queryFn: async () => {
            const result = await getVendors()
            return (result || []).map((v: any) => ({
                id: v.id,
                name: v.name,
                code: v.code || "",
            }))
        },
        enabled,
        staleTime: 2 * 60 * 1000,
    })

    const products = useQuery({
        queryKey: ["directPurchase", "products"],
        queryFn: async () => {
            const res = await fetch("/api/products")
            if (!res.ok) throw new Error("Failed to fetch products")
            const data = await res.json()
            return (data.products || data || []).map((p: any) => ({
                id: p.id,
                name: p.name,
                code: p.code || "",
                unit: p.unit || "",
                price: Number(p.price || p.basePrice || 0),
            }))
        },
        enabled,
        staleTime: 2 * 60 * 1000,
    })

    const warehouses = useQuery({
        queryKey: ["directPurchase", "warehouses"],
        queryFn: async () => {
            const result = await getWarehousesForGRN()
            return (result || []).map((w: any) => ({
                id: w.id,
                name: w.name,
                code: w.code || "",
            }))
        },
        enabled,
        staleTime: 2 * 60 * 1000,
    })

    return {
        vendors: vendors.data || [],
        products: products.data || [],
        warehouses: warehouses.data || [],
        isLoading: vendors.isLoading || products.isLoading || warehouses.isLoading,
    }
}

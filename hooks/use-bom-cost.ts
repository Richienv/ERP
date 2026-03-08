"use client"

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import type { BOMCostResult } from "@/lib/bom-costing"
import { toast } from "sonner"

interface BOMCostResponse extends BOMCostResult {
  product: {
    id: string
    code: string
    name: string
    unit: string
    costPrice: any
    sellingPrice: any
  }
  version: string
  isActive: boolean
}

/**
 * Fetch cost breakdown for a BillOfMaterials (not ProductionBOM).
 * Used in API mode of BOMCostCard.
 */
export function useBOMCost(bomId: string | null) {
  return useQuery<BOMCostResponse | null>({
    queryKey: queryKeys.bom.cost(bomId || ""),
    queryFn: async () => {
      if (!bomId) return null
      const res = await fetch(`/api/manufacturing/bom/${bomId}/cost`)
      if (!res.ok) return null
      const result = await res.json()
      return result.success ? result.data : null
    },
    enabled: !!bomId,
  })
}

/**
 * Update a product's costPrice from BOM calculation.
 *
 * For BillOfMaterials: uses POST /api/manufacturing/bom/[id]/cost
 * For ProductionBOM (inline mode): uses PATCH /api/products/[id] directly
 */
export function useUpdateProductCostFromBOM(bomId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params?: { productId: string; costPerUnit: number }) => {
      if (params?.productId) {
        // Direct product update (inline mode from ProductionBOM page)
        const res = await fetch(`/api/products/${params.productId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ costPrice: params.costPerUnit }),
        })
        const result = await res.json()
        if (!result.success) throw new Error(result.error || "Gagal memperbarui harga pokok")
        return { costPerUnit: params.costPerUnit }
      }

      if (!bomId) throw new Error("BOM ID tidak valid")
      // BillOfMaterials mode
      const res = await fetch(`/api/manufacturing/bom/${bomId}/cost`, {
        method: "POST",
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    onSuccess: (data) => {
      const formatted = new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
      }).format(data.costPerUnit)
      toast.success(`Harga pokok diperbarui: ${formatted}`)
      // Invalidate related queries
      if (bomId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.bom.cost(bomId) })
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.productionBom.all })
    },
    onError: (error: Error) => {
      toast.error(error.message || "Gagal memperbarui harga pokok")
    },
  })
}

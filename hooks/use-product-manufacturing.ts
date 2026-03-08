"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export interface BOMUsage {
  id: string
  bomId: string
  bomVersion: string
  bomIsActive: boolean
  productId: string
  productName: string
  productCode: string
  quantityPerUnit: number
  wastePct: number
  unit: string | null
}

export interface ActiveWorkOrder {
  id: string
  number: string
  productName: string
  productCode: string
  plannedQty: number
  actualQty: number
  requiredQty: number
  status: string
  startDate: string | null
  dueDate: string | null
}

export interface StockSummary {
  totalStock: number
  totalReserved: number
  totalAvailable: number
  onOrder: number
  activeDemand: number
  netAvailable: number
}

export interface SupplyStatus {
  label: "Cukup" | "Segera Pesan" | "Kurang"
  color: "green" | "yellow" | "red"
}

export interface ProductManufacturingData {
  bomUsages: BOMUsage[]
  activeWorkOrders: ActiveWorkOrder[]
  stockSummary: StockSummary
  supplyStatus: SupplyStatus
}

export function useProductManufacturing(productId: string) {
  return useQuery<ProductManufacturingData>({
    queryKey: queryKeys.products.manufacturing(productId),
    queryFn: async () => {
      const res = await fetch(`/api/products/${productId}/manufacturing-usage`)
      if (!res.ok) throw new Error("Gagal memuat data manufaktur")
      return res.json()
    },
    enabled: !!productId,
  })
}

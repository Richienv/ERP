"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

interface InventorySettings {
  allowNegativeStock: boolean
}

export function useInventorySettings() {
  return useQuery<InventorySettings>({
    queryKey: queryKeys.inventorySettings.list(),
    queryFn: async () => {
      const res = await fetch("/api/inventory/settings")
      if (!res.ok) throw new Error("Gagal memuat pengaturan inventori")
      return res.json()
    },
  })
}

export function useUpdateInventorySettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (settings: Partial<InventorySettings>) => {
      const res = await fetch("/api/inventory/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error("Gagal menyimpan pengaturan inventori")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventorySettings.all })
    },
  })
}

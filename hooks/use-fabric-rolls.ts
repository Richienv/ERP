"use client"

import { useQuery } from "@tanstack/react-query"
import { getFabricRolls, getWarehousesForRolls, getFabricProducts } from "@/lib/actions/fabric-rolls"
import { queryKeys } from "@/lib/query-keys"

export function useFabricRolls() {
    return useQuery({
        queryKey: queryKeys.fabricRolls.list(),
        queryFn: async () => {
            const [rolls, warehouses, products] = await Promise.all([
                getFabricRolls(),
                getWarehousesForRolls(),
                getFabricProducts(),
            ])
            return { rolls, warehouses, products }
        },
    })
}

"use client"

import { useQuery } from "@tanstack/react-query"
import { getWarehouses } from "@/app/actions/inventory"

export function useWarehouses() {
    return useQuery({
        queryKey: ["warehouses", "list"],
        queryFn: async () => {
            const warehouses = await getWarehouses()
            return warehouses
        },
    })
}

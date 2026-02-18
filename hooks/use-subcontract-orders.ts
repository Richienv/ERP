"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
    getSubcontractOrders,
    getSubcontractors,
    getProductsForSubcontract,
} from "@/lib/actions/subcontract"

export function useSubcontractOrders() {
    return useQuery({
        queryKey: queryKeys.subcontractOrders.list(),
        queryFn: async () => {
            const [orders, subcontractors, products] = await Promise.all([
                getSubcontractOrders(),
                getSubcontractors(),
                getProductsForSubcontract(),
            ])
            return { orders, subcontractors, products }
        },
    })
}

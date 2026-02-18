"use client"

import { useQuery } from "@tanstack/react-query"
import { getStockTransfers, getTransferFormData } from "@/lib/actions/stock-transfers"

export function useStockTransfers() {
    return useQuery({
        queryKey: ["stockTransfers", "list"],
        queryFn: async () => {
            const [transfers, formData] = await Promise.all([
                getStockTransfers(),
                getTransferFormData(),
            ])
            return { transfers, warehouses: formData.warehouses, products: formData.products }
        },
    })
}

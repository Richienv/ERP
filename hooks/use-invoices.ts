"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getInvoiceKanbanData, type InvoiceKanbanData } from "@/lib/actions/finance-invoices"

const emptyKanban: InvoiceKanbanData = { draft: [], sent: [], overdue: [], paid: [] }

export function useInvoiceKanban(params?: { q?: string; type?: string }) {
    return useQuery({
        queryKey: queryKeys.invoices.kanban(params),
        queryFn: async () => {
            const kanban = await getInvoiceKanbanData({
                q: params?.q || null,
                type: (params?.type as "ALL" | "INV_OUT" | "INV_IN") || "ALL",
            })
            return kanban || emptyKanban
        },
    })
}

"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"
import { type InvoiceKanbanData } from "@/lib/actions/finance-invoices"
import { apiFetch } from "@/lib/http/api-fetch"

function invoicesListUrl(params?: { q?: string; type?: string }) {
    const search = new URLSearchParams()
    if (params?.q) search.set("q", params.q)
    if (params?.type) search.set("type", params.type)
    const qs = search.toString()
    return qs ? `/api/finance/lists/invoices?${qs}` : "/api/finance/lists/invoices"
}

export function useInvoiceKanban(params?: { q?: string; type?: string }) {
    return useQuery({
        queryKey: queryKeys.invoices.kanban(params),
        queryFn: () => apiFetch<InvoiceKanbanData>(invoicesListUrl(params)),
        ...CACHE_TIERS.TRANSACTIONAL,
    })
}

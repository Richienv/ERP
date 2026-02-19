"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getDocumentNumbering, type DocumentNumberingConfig } from "@/lib/actions/settings"

async function fetchDocumentNumbering(): Promise<DocumentNumberingConfig[]> {
    const result = await getDocumentNumbering()
    if (result.success && result.data) return result.data
    return []
}

export function useDocumentNumbering() {
    return useQuery({
        queryKey: queryKeys.documentNumbering.list(),
        queryFn: fetchDocumentNumbering,
    })
}

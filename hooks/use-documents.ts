"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getDocumentSystemOverview } from "@/app/actions/documents-system"

export function useDocuments() {
    return useQuery({
        queryKey: queryKeys.documents.list(),
        queryFn: async () => {
            const result = await getDocumentSystemOverview({ registryQuery: {} })
            if (!result.success || !("data" in result) || !result.data) {
                throw new Error(("error" in result ? result.error : undefined) || "Failed to fetch documents")
            }
            return result.data
        },
    })
}

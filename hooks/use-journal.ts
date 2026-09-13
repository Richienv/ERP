"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"
import { apiFetch } from "@/lib/http/api-fetch"

type JournalPageData = {
    entries: Awaited<ReturnType<typeof import("@/lib/actions/finance-gl").getJournalEntries>>
    accounts: Awaited<ReturnType<typeof import("@/lib/actions/finance-gl").getGLAccountsList>>
}

export function useJournal() {
    return useQuery({
        queryKey: queryKeys.journal.list(),
        queryFn: () => apiFetch<JournalPageData>("/api/finance/lists/journal"),
        ...CACHE_TIERS.TRANSACTIONAL,
    })
}

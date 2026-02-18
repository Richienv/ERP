"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getJournalEntries, getGLAccountsList } from "@/lib/actions/finance"

export function useJournal() {
    return useQuery({
        queryKey: queryKeys.journal.list(),
        queryFn: async () => {
            const [entries, accounts] = await Promise.all([
                getJournalEntries(50),
                getGLAccountsList(),
            ])
            return { entries, accounts }
        },
    })
}

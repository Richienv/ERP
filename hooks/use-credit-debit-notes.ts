"use client"

import { useQuery } from "@tanstack/react-query"
import { getCreditDebitNotes, getCreditDebitNoteAccounts } from "@/lib/actions/finance"

export function useCreditDebitNotes() {
    return useQuery({
        queryKey: ["credit-debit-notes", "list"],
        queryFn: async () => {
            const [notes, accounts] = await Promise.all([
                getCreditDebitNotes(),
                getCreditDebitNoteAccounts(),
            ])
            return { notes, ...accounts }
        },
    })
}

"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getDCNotes, getDCNoteById, getDCNoteFormData } from "@/lib/actions/finance-dcnotes"
import type { DCNoteType, DCNoteStatus } from "@prisma/client"

export function useDCNotes(filters?: { type?: DCNoteType; status?: DCNoteStatus }) {
    return useQuery({
        queryKey: queryKeys.dcNotes.list(filters),
        queryFn: () => getDCNotes(filters),
    })
}

export function useDCNoteDetail(id: string) {
    return useQuery({
        queryKey: queryKeys.dcNotes.detail(id),
        queryFn: () => getDCNoteById(id),
        enabled: !!id,
    })
}

export function useDCNoteFormData() {
    return useQuery({
        queryKey: queryKeys.dcNotes.formData(),
        queryFn: () => getDCNoteFormData(),
    })
}

// Keep old hook for backward compatibility during migration (Task 7 will remove)
export function useCreditDebitNotes() {
    return useQuery({
        queryKey: ["credit-debit-notes", "list"],
        queryFn: async () => {
            // Import old functions lazily to avoid circular deps
            const { getCreditDebitNotes, getCreditDebitNoteAccounts } = await import("@/lib/actions/finance")
            const [notes, accounts] = await Promise.all([
                getCreditDebitNotes(),
                getCreditDebitNoteAccounts(),
            ])
            return { notes, ...accounts }
        },
    })
}

"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getThreeWayMatch } from "@/lib/actions/finance-match"
import type { ThreeWayMatch } from "@/lib/three-way-match"

/**
 * Load PO ↔ GRN ↔ Bill match for a draft bill detail dialog.
 * Caller must pass enabled only when the dialog is open AND status === "DRAFT".
 */
export function useBillMatch(billId: string | null | undefined, enabled: boolean) {
    return useQuery<ThreeWayMatch>({
        queryKey: queryKeys.bills.match(billId ?? ""),
        queryFn: () => getThreeWayMatch(billId as string),
        enabled: Boolean(enabled && billId),
    })
}

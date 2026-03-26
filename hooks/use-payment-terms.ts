"use client"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getPaymentTerms } from "@/lib/actions/payment-terms"

export function usePaymentTerms() {
    return useQuery({
        queryKey: queryKeys.paymentTerms.list(),
        queryFn: () => getPaymentTerms(),
    })
}

export function useInvalidatePaymentTerms() {
    const qc = useQueryClient()
    return () => qc.invalidateQueries({ queryKey: queryKeys.paymentTerms.all() })
}

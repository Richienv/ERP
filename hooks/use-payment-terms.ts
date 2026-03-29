"use client"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getPaymentTerms } from "@/lib/actions/payment-terms"
import { getFallbackPaymentTermOptions, normalizePaymentTermOptions } from "@/lib/payment-term-options"

export function usePaymentTerms() {
    return useQuery({
        queryKey: queryKeys.paymentTerms.list(),
        queryFn: async () => {
            try {
                const terms = await getPaymentTerms()
                return normalizePaymentTermOptions(terms)
            } catch (error) {
                console.warn("[usePaymentTerms] falling back to legacy payment terms", error)
                return getFallbackPaymentTermOptions()
            }
        },
    })
}

export function useInvalidatePaymentTerms() {
    const qc = useQueryClient()
    return () => qc.invalidateQueries({ queryKey: queryKeys.paymentTerms.all() })
}

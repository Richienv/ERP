"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getARPaymentRegistry, getARPaymentStats } from "@/lib/actions/finance"

interface ARPaymentsParams {
    paymentsQ?: string
    invoicesQ?: string
    customerId?: string
    paymentPage?: number
    invoicePage?: number
    pageSize?: number
}

export function useARPayments(params: ARPaymentsParams = {}) {
    return useQuery({
        queryKey: queryKeys.arPayments.all,
        queryFn: async () => {
            const [registry, stats] = await Promise.all([
                getARPaymentRegistry({
                    paymentsQ: params.paymentsQ,
                    invoicesQ: params.invoicesQ,
                    customerId: params.customerId,
                    paymentPage: params.paymentPage,
                    invoicePage: params.invoicePage,
                    pageSize: params.pageSize,
                }),
                getARPaymentStats(),
            ])
            return { registry, stats }
        },
    })
}

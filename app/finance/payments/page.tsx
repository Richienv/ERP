"use client"

import { useSearchParams } from "next/navigation"
import { useARPayments } from "@/hooks/use-ar-payments"
import { ARPaymentsView } from "./payments-view"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export default function ARPaymentsPage() {
    const searchParams = useSearchParams()

    const paymentPage = Number(searchParams.get("pay_page")) || undefined
    const invoicePage = Number(searchParams.get("inv_page")) || undefined
    const pageSize = Number(searchParams.get("size")) || undefined

    const { data, isLoading } = useARPayments({
        paymentsQ: searchParams.get("pay_q") ?? undefined,
        invoicesQ: searchParams.get("inv_q") ?? undefined,
        customerId: searchParams.get("customer") ?? undefined,
        paymentPage: Number.isFinite(paymentPage) ? paymentPage : undefined,
        invoicePage: Number.isFinite(invoicePage) ? invoicePage : undefined,
        pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
    })

    if (isLoading || !data) {
        return <TablePageSkeleton accentColor="bg-green-400" />
    }

    const registry = data.registry ?? {} as Record<string, unknown>
    const defaultMeta = { payments: { page: 1, pageSize: 20, total: 0, totalPages: 1 }, invoices: { page: 1, pageSize: 20, total: 0, totalPages: 1 } }
    const defaultQuery = { paymentsQ: null, invoicesQ: null, customerId: null }

    return (
        <ARPaymentsView
            unallocated={registry.unallocated ?? []}
            openInvoices={registry.openInvoices ?? []}
            recentPayments={registry.recentPayments ?? []}
            allCustomers={registry.allCustomers ?? []}
            stats={data.stats ?? { unallocatedCount: 0, unallocatedAmount: 0, openInvoicesCount: 0, outstandingAmount: 0, todayPayments: 0 }}
            registryMeta={registry.meta ?? defaultMeta}
            registryQuery={registry.query ?? defaultQuery}
            highlightPaymentId={searchParams.get("highlight") ?? undefined}
        />
    )
}

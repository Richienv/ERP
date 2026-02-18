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

    return (
        <ARPaymentsView
            unallocated={data.registry.unallocated}
            openInvoices={data.registry.openInvoices}
            stats={data.stats}
            registryMeta={data.registry.meta}
            registryQuery={data.registry.query}
        />
    )
}

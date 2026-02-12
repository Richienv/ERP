import { getARPaymentRegistry, getARPaymentStats } from "@/lib/actions/finance"
import { ARPaymentsView } from "./payments-view"

type SearchParamsValue = string | string[] | undefined

const readSearchParam = (params: Record<string, SearchParamsValue>, key: string) => {
    const value = params[key]
    if (Array.isArray(value)) return value[0]
    return value
}

const readSearchParamInt = (params: Record<string, SearchParamsValue>, key: string) => {
    const value = Number(readSearchParam(params, key))
    if (!Number.isFinite(value)) return undefined
    return Math.trunc(value)
}

export default async function ARPaymentsPage({
    searchParams,
}: {
    searchParams?: Promise<Record<string, SearchParamsValue>> | Record<string, SearchParamsValue>
}) {
    const resolvedSearchParams = searchParams
        ? (typeof (searchParams as Promise<Record<string, SearchParamsValue>>).then === "function"
            ? await (searchParams as Promise<Record<string, SearchParamsValue>>)
            : (searchParams as Record<string, SearchParamsValue>))
        : {}

    const [registry, stats] = await Promise.all([
        getARPaymentRegistry({
            paymentsQ: readSearchParam(resolvedSearchParams, "pay_q"),
            invoicesQ: readSearchParam(resolvedSearchParams, "inv_q"),
            customerId: readSearchParam(resolvedSearchParams, "customer"),
            paymentPage: readSearchParamInt(resolvedSearchParams, "pay_page"),
            invoicePage: readSearchParamInt(resolvedSearchParams, "inv_page"),
            pageSize: readSearchParamInt(resolvedSearchParams, "size"),
        }),
        getARPaymentStats()
    ])

    return (
        <ARPaymentsView
            unallocated={registry.unallocated}
            openInvoices={registry.openInvoices}
            stats={stats}
            registryMeta={registry.meta}
            registryQuery={registry.query}
        />
    )
}

import { getUnallocatedPayments, getOpenInvoices, getARPaymentStats } from "@/lib/actions/finance"
import { ARPaymentsView } from "./payments-view"

export default async function ARPaymentsPage() {
    const [unallocatedPayments, openInvoices, stats] = await Promise.all([
        getUnallocatedPayments(),
        getOpenInvoices(),
        getARPaymentStats()
    ])

    return (
        <ARPaymentsView
            unallocated={unallocatedPayments}
            openInvoices={openInvoices}
            stats={stats}
        />
    )
}

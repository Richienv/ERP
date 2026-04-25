import type { LinkedDoc } from "@/components/integra/linked-docs-panel"

/**
 * Build the linked-docs trail for a Purchase Order detail view.
 * Order: PR(s) → PO (current) → GRN(s) → Bill(s)
 *
 * The current PO is always included with `current: true` and no href.
 * Returns a flat trail array consumable by <LinkedDocsPanel>.
 */
export function buildLinkedDocs(data: any): LinkedDoc[] {
    const trail: LinkedDoc[] = []

    // Upstream: Purchase Requests that originated this PO
    data?.purchaseRequests?.forEach((pr: any) => {
        trail.push({
            type: "PR",
            number: pr.number,
            status: pr.status,
            href: `/procurement/requests/${pr.id}`,
        })
    })

    // Current: this PO
    trail.push({
        type: "PO",
        number: data.number,
        status: data.status,
        current: true,
    })

    // Downstream: Goods Received Notes
    data?.grns?.forEach((grn: any) => {
        trail.push({
            type: "GRN",
            number: grn.number,
            status: grn.status,
            href: `/procurement/receiving/${grn.id}`,
        })
    })

    // Downstream: Vendor Bills (Invoices)
    data?.bills?.forEach((bill: any) => {
        trail.push({
            type: "BILL",
            number: bill.number,
            status: bill.status,
            href: `/finance/invoices/${bill.id}`,
        })
    })

    return trail
}

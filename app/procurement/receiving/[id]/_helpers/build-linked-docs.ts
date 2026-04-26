import type { LinkedDoc } from "@/components/integra/linked-docs-panel"

/**
 * Build the linked-docs trail for a Goods Received Note (GRN) detail view.
 * Order: PO (origin) → GRN (current) → Bill(s)
 *
 * The current GRN is always included with `current: true` and no href.
 * Returns a flat trail array consumable by <LinkedDocsPanel>.
 */
export function buildLinkedDocs(data: any): LinkedDoc[] {
    const trail: LinkedDoc[] = []

    // Upstream: originating Purchase Order
    if (data?.purchaseOrder) {
        trail.push({
            type: "PO",
            number: data.purchaseOrder.number,
            status: data.purchaseOrder.status,
            href: `/procurement/orders/${data.purchaseOrder.id}`,
        })
    }

    // Current: this GRN
    trail.push({
        type: "GRN",
        number: data.number,
        status: data.status,
        current: true,
    })

    // Downstream: Vendor Bills (Invoices) generated from the same PO
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

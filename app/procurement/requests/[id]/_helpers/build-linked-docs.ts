import type { LinkedDoc } from "@/components/integra/linked-docs-panel"

/**
 * Build the linked-docs trail for a Purchase Request detail view.
 * Order: PR (current) → PO (if converted)
 *
 * The current PR is always included with `current: true` and no href.
 */
export function buildLinkedDocs(data: any): LinkedDoc[] {
    const trail: LinkedDoc[] = []

    // Current: this PR
    trail.push({
        type: "PR",
        number: data.number,
        status: data.status,
        current: true,
    })

    // Downstream: Purchase Order it was converted to
    if (data?.purchaseOrder) {
        trail.push({
            type: "PO",
            number: data.purchaseOrder.number,
            status: data.purchaseOrder.status,
            href: `/procurement/orders/${data.purchaseOrder.id}`,
        })
    }

    return trail
}

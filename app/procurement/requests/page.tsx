export const dynamic = 'force-dynamic'

import { getPurchaseRequests } from "@/lib/actions/procurement"
import { RequestList } from "@/components/procurement/request-list"

export default async function PurchaseRequestsPage() {
    const requests = await getPurchaseRequests()

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 font-sans">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black font-serif tracking-tight text-black flex items-center gap-2">
                        Permintaan Pembelian (PR)
                    </h2>
                    <p className="text-muted-foreground mt-1 font-medium">Inbox persetujuan pengadaan dari departemen internal.</p>
                </div>
            </div>

            <RequestList data={requests} />

        </div>
    )
}

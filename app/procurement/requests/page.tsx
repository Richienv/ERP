export const dynamic = 'force-dynamic'

import { getPurchaseRequests } from "@/lib/actions/procurement"
import { RequestList } from "@/components/procurement/request-list"
import { ClipboardList } from "lucide-react"
import Link from "next/link"

export default async function PurchaseRequestsPage() {
    const requests = await getPurchaseRequests()

    return (
        <div className="p-4 md:p-8 pt-6 max-w-[1600px] mx-auto space-y-4 bg-zinc-50 dark:bg-black min-h-screen">

            {/* ═══ COMMAND HEADER ═══ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-amber-400">
                    <div className="flex items-center gap-3">
                        <ClipboardList className="h-5 w-5 text-amber-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Permintaan Pembelian (PR)
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Inbox persetujuan pengadaan dari departemen internal
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <RequestList data={requests} />
        </div>
    )
}

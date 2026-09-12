"use client"

import { usePurchaseRequests } from "@/hooks/use-purchase-requests"
import { RequestList } from "@/components/procurement/request-list"
import { NewPRDialog } from "@/components/procurement/new-pr-dialog"
import { ClipboardList } from "lucide-react"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { InlinePendingBar } from "@/components/ui/inline-pending"

export default function PurchaseRequestsPage() {
    const { data, isFetching } = usePurchaseRequests()

    if (!data) {
        return <TablePageSkeleton accentColor="bg-orange-400" />
    }

    return (
        <div className="mf-page">
            {/* COMMAND HEADER */}
            <div className="relative border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <InlinePendingBar active={isFetching} />
                <div className="px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-l-[6px] border-l-amber-400">
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
                    <NewPRDialog />
                </div>
            </div>

            <RequestList data={data} />
        </div>
    )
}

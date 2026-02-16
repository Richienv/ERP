import { Suspense } from "react"
import { WorkOrdersClient } from "./work-orders-client"
import { ClipboardList } from "lucide-react"

export const dynamic = "force-dynamic"

async function WorkOrdersContent() {
    try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3002"
        const params = new URLSearchParams({ orderType: "SPK" })
        const res = await fetch(`${baseUrl}/api/manufacturing/work-orders?${params.toString()}`, { cache: "no-store" })
        if (!res.ok) return <WorkOrdersClient initialOrders={[]} />
        const result = await res.json()
        return <WorkOrdersClient initialOrders={result.success ? result.data : []} />
    } catch {
        return <WorkOrdersClient initialOrders={[]} />
    }
}

export default function WorkOrdersPage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-[calc(100svh-theme(spacing.16))] w-full flex-col items-center justify-center bg-zinc-50 dark:bg-black p-4">
                    <div className="flex items-center gap-2 text-zinc-400 border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
                        <ClipboardList className="h-5 w-5 animate-spin" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Memuat perintah kerja...
                        </span>
                    </div>
                </div>
            }
        >
            <WorkOrdersContent />
        </Suspense>
    )
}

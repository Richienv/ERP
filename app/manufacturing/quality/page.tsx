import { Suspense } from "react"
import { QualityClient } from "./quality-client"
import { ClipboardCheck } from "lucide-react"

export const dynamic = "force-dynamic"

async function QualityContent() {
    const emptySummary = { passRate: 100, defectCount: 0, pendingCount: 0, todayCount: 0 }

    try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3002"
        const res = await fetch(`${baseUrl}/api/manufacturing/quality`, { cache: "no-store" })
        if (!res.ok) return <QualityClient initialInspections={[]} initialPendingQueue={[]} initialSummary={emptySummary} />
        const result = await res.json()
        const inspections = result.success ? result.data : []
        const pendingQueue = result.success ? (result.pendingQueue || []) : []
        const summary = result.success ? result.summary : emptySummary
        return <QualityClient initialInspections={inspections} initialPendingQueue={pendingQueue} initialSummary={summary} />
    } catch {
        return <QualityClient initialInspections={[]} initialPendingQueue={[]} initialSummary={emptySummary} />
    }
}

export default function QualityControlPage() {
    return (
        <div className="p-4 md:p-6 lg:p-8 pt-6 w-full space-y-4 bg-zinc-50 dark:bg-black min-h-screen">
            <Suspense
                fallback={
                    <div className="flex items-center gap-2 text-zinc-400 pt-8">
                        <ClipboardCheck className="h-5 w-5 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Memuat kontrol kualitas...
                        </span>
                    </div>
                }
            >
                <QualityContent />
            </Suspense>
        </div>
    )
}

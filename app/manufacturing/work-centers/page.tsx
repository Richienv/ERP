import { Suspense } from "react"
import { WorkCentersClient } from "./work-centers-client"
import { Settings } from "lucide-react"

export const dynamic = "force-dynamic"

async function WorkCentersContent() {
    const emptySummary = { total: 0, active: 0, down: 0, avgEfficiency: 0 }

    try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3002"
        const res = await fetch(`${baseUrl}/api/manufacturing/machines`, { cache: "no-store" })

        if (!res.ok) {
            console.error("Failed to fetch machines:", res.status, res.statusText);
            return <WorkCentersClient initialMachines={[]} initialSummary={emptySummary} />
        }

        const result = await res.json()
        const machines = result.success ? result.data : []
        const summary = result.success ? result.summary : emptySummary

        return <WorkCentersClient initialMachines={machines} initialSummary={summary} />
    } catch (error) {
        console.error("Error loading machines:", error);
        return <WorkCentersClient initialMachines={[]} initialSummary={emptySummary} />
    }
}

export default function WorkCentersPage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-[calc(100svh-theme(spacing.16))] w-full flex-col items-center justify-center bg-zinc-50 dark:bg-black p-4">
                    <div className="flex items-center gap-2 text-zinc-400 border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
                        <Settings className="h-5 w-5 animate-spin" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Memuat pusat kerja...
                        </span>
                    </div>
                </div>
            }
        >
            <WorkCentersContent />
        </Suspense>
    )
}

import { Suspense } from "react"
import { RoutingClient } from "./routing-client"
import { Route } from "lucide-react"

export const dynamic = "force-dynamic"

async function RoutingContent() {
    try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3002"
        const res = await fetch(`${baseUrl}/api/manufacturing/routing`, { cache: "no-store" })
        if (!res.ok) return <RoutingClient initialRoutings={[]} />
        const result = await res.json()
        return <RoutingClient initialRoutings={result.success ? result.data : []} />
    } catch {
        return <RoutingClient initialRoutings={[]} />
    }
}

export default function RoutingPage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-[calc(100svh-theme(spacing.16))] w-full flex-col items-center justify-center bg-zinc-50 dark:bg-black p-4">
                    <div className="flex items-center gap-2 text-zinc-400 border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
                        <Route className="h-5 w-5 animate-spin" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Memuat routing proses...
                        </span>
                    </div>
                </div>
            }
        >
            <RoutingContent />
        </Suspense>
    )
}

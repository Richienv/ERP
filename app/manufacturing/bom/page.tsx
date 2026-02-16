import { Suspense } from "react"
import { BOMClient } from "./bom-client"
import { Layers, Settings } from "lucide-react"

export const dynamic = "force-dynamic"

async function BOMContent() {
    const emptyBoms = []

    try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3002"
        const res = await fetch(`${baseUrl}/api/manufacturing/bom`, { cache: "no-store" })

        if (!res.ok) {
            console.error("Failed to fetch BOMs:", res.status, res.statusText);
            return <BOMClient initialBoms={[]} />
        }

        const result = await res.json()
        return <BOMClient initialBoms={result.success ? result.data : []} />
    } catch (error) {
        console.error("Error loading BOMs:", error);
        return <BOMClient initialBoms={[]} />
    }
}

export default function BOMPage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-[calc(100svh-theme(spacing.16))] w-full flex-col items-center justify-center bg-zinc-50 dark:bg-black p-4">
                    <div className="flex items-center gap-2 text-zinc-400 border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
                        <Layers className="h-5 w-5 animate-spin" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Memuat Bill of Materials...
                        </span>
                    </div>
                </div>
            }
        >
            <BOMContent />
        </Suspense>
    )
}

import { Suspense } from "react"
import { GroupsClient } from "./groups-client"
import { FolderKanban } from "lucide-react"

export const dynamic = "force-dynamic"

async function GroupsContent() {
    try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3002"
        const res = await fetch(`${baseUrl}/api/manufacturing/groups`, { cache: "no-store" })
        if (!res.ok) return <GroupsClient initialGroups={[]} />
        const result = await res.json()
        return <GroupsClient initialGroups={result.success ? result.data : []} />
    } catch {
        return <GroupsClient initialGroups={[]} />
    }
}

export default function WorkCenterGroupsPage() {
    return (
        <div className="min-h-screen bg-background pb-24">
            <Suspense
                fallback={
                    <div className="flex items-center gap-2 text-zinc-400 pt-8">
                        <FolderKanban className="h-5 w-5 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Memuat grup pusat kerja...
                        </span>
                    </div>
                }
            >
                <GroupsContent />
            </Suspense>
        </div>
    )
}

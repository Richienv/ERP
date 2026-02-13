"use client"

import { Clock, FileText, Package, UserPlus, ArrowRight } from "lucide-react"
import Link from "next/link"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Activity {
    id: string
    type: string
    title: string
    description: string
    timestamp: string
    icon?: string
}

interface CompactActivityFeedProps {
    activities: Activity[]
}

function getIcon(type: string) {
    switch (type) {
        case "invoice": return <FileText className="h-3.5 w-3.5 text-purple-500" />
        case "inventory": return <Package className="h-3.5 w-3.5 text-emerald-500" />
        case "hire": return <UserPlus className="h-3.5 w-3.5 text-blue-500" />
        default: return <Clock className="h-3.5 w-3.5 text-zinc-400" />
    }
}

function timeAgo(dateStr: string): string {
    try {
        const now = new Date()
        const date = new Date(dateStr)
        const diffMs = now.getTime() - date.getTime()
        const diffMin = Math.floor(diffMs / 60000)
        if (diffMin < 1) return "baru saja"
        if (diffMin < 60) return `${diffMin}m lalu`
        const diffH = Math.floor(diffMin / 60)
        if (diffH < 24) return `${diffH}j lalu`
        const diffD = Math.floor(diffH / 24)
        return `${diffD}h lalu`
    } catch {
        return dateStr
    }
}

export function CompactActivityFeed({ activities }: CompactActivityFeedProps) {
    const displayActivities = activities.slice(0, 6)

    return (
        <div className="h-full flex flex-col bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
            {/* Header */}
            <div className="flex-none flex items-center justify-between px-4 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800">
                <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-zinc-500" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Aktivitas Terbaru</h3>
                </div>
                <span className="bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5">LIVE</span>
            </div>

            {/* Feed Items */}
            <ScrollArea className="flex-1 min-h-0">
                {displayActivities.length > 0 ? (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {displayActivities.map((activity, i) => (
                            <div key={activity.id || i} className="flex items-start gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <div className="flex-none mt-0.5">{getIcon(activity.type)}</div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{activity.title}</p>
                                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{activity.description}</p>
                                </div>
                                <span className="flex-none text-[10px] font-mono text-zinc-400 whitespace-nowrap">{timeAgo(activity.timestamp)}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full py-8">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Belum ada aktivitas</p>
                    </div>
                )}
            </ScrollArea>

            {/* Footer */}
            <div className="flex-none border-t-2 border-black">
                <Link href="/reports" className="flex items-center justify-center gap-1 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all">
                    Lihat Semua <ArrowRight className="h-3 w-3" />
                </Link>
            </div>
        </div>
    )
}

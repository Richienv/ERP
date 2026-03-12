"use client"

import { useEffect, useState } from "react"
import { History, Loader2, Save, Plus, Minus, Zap, X, ChevronDown } from "lucide-react"

interface EditLog {
    id: string
    action: string
    summary: string
    details?: { changes?: string[] } | null
    createdAt: string
}

interface EditHistoryDrawerProps {
    bomId: string
    open: boolean
    onClose: () => void
}

const ACTION_CONFIG: Record<string, { icon: typeof Save; color: string; bg: string }> = {
    SAVE: { icon: Save, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
    ADD_STEP: { icon: Plus, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
    REMOVE_STEP: { icon: Minus, color: "text-red-600", bg: "bg-red-50 border-red-200" },
    GENERATE_SPK: { icon: Zap, color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
}

function LogEntry({ log }: { log: EditLog }) {
    const [expanded, setExpanded] = useState(false)
    const config = ACTION_CONFIG[log.action] || ACTION_CONFIG.SAVE
    const Icon = config.icon
    const changes = log.details?.changes || []
    const hasDetails = changes.length > 0

    return (
        <div className={`border ${config.bg} overflow-hidden`}>
            <button
                type="button"
                onClick={() => hasDetails && setExpanded(!expanded)}
                className={`w-full text-left p-3 ${hasDetails ? "cursor-pointer hover:brightness-95" : "cursor-default"} transition-all`}
            >
                <div className="flex items-center gap-2 mb-1">
                    <Icon className={`h-3.5 w-3.5 ${config.color} shrink-0`} />
                    <span className={`text-[10px] font-black uppercase ${config.color}`}>{log.action}</span>
                    <span className="text-[9px] font-mono text-zinc-400 ml-auto shrink-0">
                        {new Date(log.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
                <div className="flex items-start gap-1">
                    <p className="text-xs text-zinc-600 flex-1">
                        {hasDetails ? `${changes.length} perubahan` : log.summary}
                    </p>
                    {hasDetails && (
                        <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    )}
                </div>
            </button>
            {expanded && hasDetails && (
                <div className="border-t border-current/10 px-3 pb-3 pt-2 space-y-1">
                    {changes.map((change, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                            <span className="text-zinc-400 text-[10px] mt-0.5 shrink-0">•</span>
                            <span className="text-[11px] text-zinc-700 leading-snug">{change}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export function EditHistoryDrawer({ bomId, open, onClose }: EditHistoryDrawerProps) {
    const [logs, setLogs] = useState<EditLog[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!open) return
        setLoading(true)
        fetch(`/api/manufacturing/production-bom/${bomId}/history`)
            .then(r => r.json())
            .then(result => {
                if (result.success) setLogs(result.data || [])
            })
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [open, bomId])

    if (!open) return null

    return (
        <div className="fixed inset-y-0 right-0 w-80 z-50 bg-white border-l-2 border-black shadow-[-4px_0px_0px_0px_rgba(0,0,0,1)] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b-2 border-black bg-zinc-50">
                <div className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    <span className="text-[11px] font-black uppercase tracking-widest">Riwayat Edit</span>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-zinc-200 border border-transparent hover:border-black">
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="flex items-center justify-center py-10 text-zinc-400">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span className="text-xs font-bold uppercase">Memuat...</span>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-10 text-zinc-400 text-xs font-bold uppercase">
                        Belum ada riwayat
                    </div>
                ) : (
                    <div className="space-y-3">
                        {logs.map((log) => (
                            <LogEntry key={log.id} log={log} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

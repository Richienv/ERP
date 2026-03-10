"use client"

import { useQuery } from "@tanstack/react-query"
import { Clock, User, FileText } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { id as localeId } from "date-fns/locale"

interface AuditEntry {
  id: string
  action: string
  userName: string | null
  narrative: string | null
  changes: Record<string, { from: unknown; to: unknown }> | null
  createdAt: string
}

interface AuditLogTimelineProps {
  entityType: string
  entityId: string
}

export function AuditLogTimeline({ entityType, entityId }: AuditLogTimelineProps) {
  const { data: entries, isLoading } = useQuery<AuditEntry[]>({
    queryKey: ["audit-log", entityType, entityId],
    queryFn: async () => {
      const res = await fetch(`/api/audit-log?entityType=${entityType}&entityId=${entityId}`)
      const json = await res.json()
      return json.data ?? []
    },
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-zinc-100 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!entries?.length) {
    return (
      <div className="p-6 text-center">
        <FileText className="h-8 w-8 mx-auto text-zinc-200 mb-2" />
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
          Belum ada riwayat perubahan
        </p>
      </div>
    )
  }

  const ACTION_COLORS: Record<string, string> = {
    CREATE: "bg-emerald-400",
    UPDATE: "bg-blue-400",
    DELETE: "bg-red-400",
    STATUS_CHANGE: "bg-amber-400",
  }

  return (
    <div className="space-y-0">
      {entries.map((entry, idx) => (
        <div key={entry.id} className="flex gap-3 p-3 border-b border-zinc-100 last:border-b-0">
          <div className="flex flex-col items-center pt-1">
            <div className={`h-2.5 w-2.5 rounded-full ${ACTION_COLORS[entry.action] || "bg-zinc-300"}`} />
            {idx < entries.length - 1 && <div className="w-px flex-1 bg-zinc-200 mt-1" />}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-zinc-800">{entry.narrative}</p>

            {entry.changes && Object.keys(entry.changes).length > 0 && (
              <div className="mt-1.5 space-y-0.5">
                {Object.entries(entry.changes).slice(0, 5).map(([field, change]) => (
                  <div key={field} className="text-[10px] text-zinc-500 font-mono">
                    <span className="font-bold text-zinc-600">{field}:</span>{" "}
                    <span className="line-through text-red-400">{String(change.from)}</span>{" → "}
                    <span className="text-emerald-600">{String(change.to)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 mt-1">
              <span className="text-[9px] text-zinc-400 flex items-center gap-1">
                <User className="h-2.5 w-2.5" />
                {entry.userName || "Sistem"}
              </span>
              <span className="text-[9px] text-zinc-400 flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true, locale: localeId })}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

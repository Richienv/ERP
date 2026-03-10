"use client"

import { useState } from "react"
import { format } from "date-fns"
import { id as idLocale } from "date-fns/locale"
import { ChevronDown, ChevronUp, Clock, User } from "lucide-react"
import { Button } from "@/components/ui/button"

// ── Types ──────────────────────────────────────────────────────

export interface RevisionChange {
    field: string
    oldValue: unknown
    newValue: unknown
}

export interface RevisionEntry {
    revision: number
    changedAt: string
    changedBy?: string
    changedByEmail?: string
    reason?: string
    snapshot?: Record<string, unknown>
    changes?: RevisionChange[]
}

// ── Helpers ────────────────────────────────────────────────────

function formatValue(value: unknown): string {
    if (value === null || value === undefined) return "-"
    if (typeof value === "number") {
        return new Intl.NumberFormat("id-ID").format(value)
    }
    if (typeof value === "object") {
        return JSON.stringify(value)
    }
    return String(value)
}

function formatFieldLabel(field: string): string {
    return field
        .replace(/([A-Z])/g, " $1")
        .replace(/[_-]/g, " ")
        .replace(/^\s/, "")
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ")
}

function formatDate(dateStr: string): string {
    try {
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) return dateStr
        return format(date, "dd MMM yyyy HH:mm", { locale: idLocale })
    } catch {
        return dateStr
    }
}

// ── Component ──────────────────────────────────────────────────

interface RevisionHistoryTimelineProps {
    revisions: RevisionEntry[]
    className?: string
}

export function RevisionHistoryTimeline({ revisions, className = "" }: RevisionHistoryTimelineProps) {
    const [expanded, setExpanded] = useState(true)

    if (!revisions || revisions.length === 0) {
        return (
            <div className={`border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white p-4 ${className}`}>
                <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-zinc-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Riwayat Perubahan
                    </span>
                </div>
                <p className="text-xs text-zinc-400 italic">Belum ada riwayat perubahan</p>
            </div>
        )
    }

    // Sort by revision number descending (most recent first)
    const sorted = [...revisions].sort((a, b) => (b.revision ?? 0) - (a.revision ?? 0))

    return (
        <div className={`border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden ${className}`}>
            {/* Header */}
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="w-full px-6 py-3 border-b-2 border-black bg-zinc-50 flex items-center gap-2 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
                <Clock className="h-4 w-4 text-zinc-500" />
                <span className="text-xs font-black uppercase tracking-widest text-zinc-500">
                    Riwayat Perubahan
                </span>
                <span className="text-[10px] font-black uppercase text-zinc-400 ml-auto mr-2">
                    {sorted.length} revisi
                </span>
                {expanded ? (
                    <ChevronUp className="h-4 w-4 text-zinc-400" />
                ) : (
                    <ChevronDown className="h-4 w-4 text-zinc-400" />
                )}
            </button>

            {/* Timeline */}
            {expanded && (
                <div className="px-6 py-4">
                    <div className="relative">
                        {/* Vertical timeline line */}
                        {sorted.length > 1 && (
                            <div className="absolute left-[11px] top-6 bottom-6 w-0.5 bg-zinc-200" />
                        )}

                        <div className="space-y-6">
                            {sorted.map((rev, idx) => (
                                <RevisionItem
                                    key={rev.revision ?? idx}
                                    revision={rev}
                                    isLatest={idx === 0}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Revision Item ──────────────────────────────────────────────

function RevisionItem({ revision, isLatest }: { revision: RevisionEntry; isLatest: boolean }) {
    const [showDetails, setShowDetails] = useState(isLatest)

    return (
        <div className="relative flex gap-3">
            {/* Timeline dot */}
            <div
                className={`relative z-10 mt-0.5 flex-shrink-0 h-6 w-6 rounded-full border-2 border-black flex items-center justify-center text-[8px] font-black ${
                    isLatest ? "bg-blue-500 text-white" : "bg-white text-zinc-600"
                }`}
            >
                {revision.revision ?? "?"}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                {/* Header row */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black uppercase">
                        Revisi #{revision.revision ?? "?"}
                    </span>
                    {isLatest && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-blue-100 text-blue-700 border border-blue-300">
                            Terbaru
                        </span>
                    )}
                </div>

                {/* Meta info */}
                <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-zinc-500">
                    <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(revision.changedAt)}
                    </span>
                    {(revision.changedByEmail || revision.changedBy) && (
                        <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {revision.changedByEmail || revision.changedBy}
                        </span>
                    )}
                </div>

                {/* Reason */}
                {revision.reason && (
                    <p className="mt-1.5 text-xs text-zinc-600 bg-zinc-50 border border-zinc-200 px-2 py-1.5 italic">
                        &ldquo;{revision.reason}&rdquo;
                    </p>
                )}

                {/* Changes toggle */}
                {revision.changes && revision.changes.length > 0 && (
                    <div className="mt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] font-bold uppercase text-zinc-500 hover:text-zinc-700 px-1"
                            onClick={() => setShowDetails(!showDetails)}
                        >
                            {showDetails ? "Sembunyikan" : "Lihat"} {revision.changes.length} perubahan
                            {showDetails ? (
                                <ChevronUp className="h-3 w-3 ml-1" />
                            ) : (
                                <ChevronDown className="h-3 w-3 ml-1" />
                            )}
                        </Button>

                        {showDetails && (
                            <div className="mt-1.5 space-y-1.5">
                                {revision.changes.map((change, ci) => (
                                    <div
                                        key={ci}
                                        className="text-xs flex items-start gap-2 border border-zinc-100 px-2 py-1.5 bg-zinc-50/50"
                                    >
                                        <span className="font-bold text-zinc-600 min-w-[80px] flex-shrink-0">
                                            {formatFieldLabel(change.field)}
                                        </span>
                                        <span className="flex items-center gap-1.5 flex-wrap min-w-0">
                                            <span className="line-through text-red-500 font-medium">
                                                {formatValue(change.oldValue)}
                                            </span>
                                            <span className="text-zinc-300">&rarr;</span>
                                            <span className="text-emerald-600 font-bold">
                                                {formatValue(change.newValue)}
                                            </span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

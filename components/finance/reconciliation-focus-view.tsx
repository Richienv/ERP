"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Landmark,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    AlertCircle,
    ArrowRightLeft,
    Loader2,
    Unlink,
    Sparkles,
    UploadCloud,
    Search,
    Lock,
    Wand2,
    Download,
    FileSpreadsheet,
    X,
    Trophy,
    CircleDot,
    Circle,
    CircleCheck,
    Plus,
    Save,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { NB } from "@/lib/dialog-styles"
import type {
    ReconciliationDetail,
    ReconciliationItemData,
    SystemEntryData,
} from "@/lib/actions/finance-reconciliation"
import {
    rankMatchesForBankLine,
    type ClientBankLine,
    type ClientMatchResult,
    type TieredMatches,
    type MatchSignals,
} from "@/lib/reconciliation-match-client"

// ==============================================================================
// Types
// ==============================================================================

export interface ReconciliationFocusViewProps {
    detail: ReconciliationDetail
    isCompleted: boolean
    actionLoading: string | null

    // Handlers
    onMatchItem: (bankItemId: string, systemEntryId: string) => Promise<void>
    onUnmatchItem: (itemId: string) => Promise<void>
    onAutoMatch: () => Promise<void>
    onClose: () => Promise<void>
    onReloadDetail: (activeBankItemId?: string) => Promise<void>
    onUpdateMeta: (data: { bankStatementBalance?: number; notes?: string }) => Promise<void>
    downloadTemplateCSV: () => void

    // File upload
    fileInputRef: React.RefObject<HTMLInputElement | null>
    parsedRows: { date: string; description: string; amount: number; reference?: string }[] | null
    dragging: boolean
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    onDragOver: (e: React.DragEvent) => void
    onDragLeave: () => void
    onDrop: (e: React.DragEvent) => void
    onImportParsed: () => Promise<void>
    onClearParsed: () => void

    // Editable meta
    editBankStatementBalance: string
    setEditBankStatementBalance: (v: string) => void
    editNotes: string
    setEditNotes: (v: string) => void

    // Confirm/Reject/Ignore handlers
    onConfirmItem: (itemId: string) => Promise<void>
    onRejectItem: (itemId: string) => Promise<void>
    onIgnoreItem: (itemId: string, reason?: string) => Promise<void>
    onBulkConfirmCocok: () => Promise<void>

    // Inline journal creation (optional — gracefully degrades if not provided)
    onSearchJournals?: (reconciliationId: string, query: string, bankItemContext?: { bankAmount: number; bankDate: string | null }) => Promise<{ entryId: string; date: string; description: string; reference: string | null; amount: number; lineDescription: string | null }[]>
    onCreateJournalAndMatch?: (reconciliationId: string, bankLineId: string, journalData: { date: string; description: string; reference?: string; amount: number; debitAccountCode: string; creditAccountCode: string }) => Promise<{ success: boolean; journalId?: string; error?: string }>
    glAccounts?: { id: string; code: string; name: string; type: string }[]
}

// ==============================================================================
// Helpers
// ==============================================================================

const formatIDR = (n: number) => n.toLocaleString("id-ID")
const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    })

// 4-Layer display classification
type ReconDisplayLayer = "COCOK" | "POTENSI" | "HAMPIR" | "BELUM" | "CONFIRMED" | "IGNORED"

function getItemDisplayLayer(item: ReconciliationItemData): ReconDisplayLayer {
    if (item.matchStatus === "CONFIRMED") return "CONFIRMED"
    if (item.matchStatus === "IGNORED") return "IGNORED"
    if (item.matchStatus === "MATCHED") {
        const score = item.matchScore ?? 0
        if (score >= 95) return "COCOK"
        if (score >= 70) return "POTENSI"
        if (score >= 40) return "HAMPIR"
        return "BELUM"
    }
    return "BELUM"
}

const LAYER_CONFIG: Record<ReconDisplayLayer, {
    icon: typeof CheckCircle2
    bg: string
    text: string
    border: string
    label: string
    headerIcon: string
    headerBg: string
}> = {
    COCOK: {
        icon: CircleCheck, bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300",
        label: "COCOK", headerIcon: "\u2705", headerBg: "bg-emerald-50",
    },
    POTENSI: {
        icon: CircleDot, bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300",
        label: "POTENSI", headerIcon: "\u26A1", headerBg: "bg-amber-50",
    },
    HAMPIR: {
        icon: AlertCircle, bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-300",
        label: "HAMPIR", headerIcon: "\u26A0\uFE0F", headerBg: "bg-orange-50",
    },
    BELUM: {
        icon: Circle, bg: "bg-zinc-50", text: "text-zinc-500", border: "border-zinc-200",
        label: "BELUM", headerIcon: "\u274C", headerBg: "bg-zinc-50",
    },
    CONFIRMED: {
        icon: CheckCircle2, bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-400",
        label: "DIKONFIRMASI", headerIcon: "\u2713", headerBg: "bg-emerald-100",
    },
    IGNORED: {
        icon: X, bg: "bg-zinc-100", text: "text-zinc-500", border: "border-zinc-300",
        label: "DIABAIKAN", headerIcon: "\u2014", headerBg: "bg-zinc-100",
    },
}

type FilterTab = "SEMUA" | "COCOK" | "POTENSI" | "HAMPIR" | "BELUM"

// ==============================================================================
// Tier Badge (uses new LAYER_CONFIG)
// ==============================================================================

function TierBadge({ tier, score }: { tier: string | null; score?: number | null }) {
    if (!tier) return null
    // Map old tier names to new layer display
    const layerMap: Record<string, ReconDisplayLayer> = {
        AUTO: "COCOK", POTENTIAL: "POTENSI", MANUAL: "HAMPIR",
    }
    const layer = layerMap[tier] || "BELUM"
    const cfg = LAYER_CONFIG[layer]
    return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[7px] font-black border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
            {cfg.label}
            {score != null && <span className="font-mono">{score}%</span>}
        </span>
    )
}

// ==============================================================================
// Signal Bar — weighted breakdown of match quality
// ==============================================================================

const SIGNAL_LABELS: { key: keyof MatchSignals; label: string; weight: number }[] = [
  { key: "amount", label: "Jumlah", weight: 35 },
  { key: "reference", label: "Ref", weight: 25 },
  { key: "description", label: "Nama", weight: 20 },
  { key: "date", label: "Tgl", weight: 10 },
  { key: "direction", label: "Arah", weight: 10 },
]

function signalColor(value: number): string {
  if (value >= 0.75) return "bg-emerald-500"
  if (value >= 0.40) return "bg-amber-400"
  if (value > 0) return "bg-zinc-300"
  return "bg-red-400"
}

function SignalBar({ signals, score }: { signals: MatchSignals; score: number }) {
  return (
    <div className="mt-2">
      <div className="flex h-2 border border-black overflow-hidden">
        {SIGNAL_LABELS.map(({ key, weight }) => (
          <div
            key={key}
            className={`${signalColor(signals[key])} transition-colors`}
            style={{ width: `${weight}%` }}
            title={`${key}: ${Math.round(signals[key] * 100)}%`}
          />
        ))}
      </div>
      <div className="flex mt-0.5">
        {SIGNAL_LABELS.map(({ key, label, weight }) => (
          <span
            key={key}
            className="text-[6px] font-bold uppercase text-zinc-400 text-center truncate"
            style={{ width: `${weight}%` }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ==============================================================================
// Direction Chip — inflow/outflow label
// ==============================================================================

function DirectionChip({ amount }: { amount: number }) {
  const isInflow = amount >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] font-black border ${
      isInflow
        ? "bg-emerald-100 text-emerald-700 border-emerald-400"
        : "bg-red-100 text-red-700 border-red-400"
    }`}>
      {isInflow ? "\u2191 MASUK" : "\u2193 KELUAR"}
    </span>
  )
}

// ==============================================================================
// Highlighted Text — highlight matched references in text
// ==============================================================================

function HighlightedText({ text, matchedRefs }: { text: string; matchedRefs: string[] }) {
  if (!text || matchedRefs.length === 0) return <>{text || "-"}</>

  const patterns = matchedRefs.map((ref) => {
    const chars = ref.split("")
    let pattern = ""
    for (let i = 0; i < chars.length; i++) {
      pattern += chars[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      if (i < chars.length - 1) {
        const curr = /[A-Z]/.test(chars[i])
        const next = /[A-Z]/.test(chars[i + 1])
        if (curr !== next) pattern += "[-\\/]?"
      }
    }
    return pattern
  })

  try {
    const regex = new RegExp(`(${patterns.join("|")})`, "gi")
    const parts = text.split(regex)
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <span key={i} className="bg-orange-100 border-b border-orange-400 font-bold text-orange-800 px-0.5">
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    )
  } catch {
    return <>{text}</>
  }
}

// ==============================================================================
// Zero Match Diagnostic — explains why no matches were found
// ==============================================================================

function ZeroMatchDiagnostic({
  currentItem,
  allSystemEntries,
}: {
  currentItem: ReconciliationItemData
  allSystemEntries: SystemEntryData[]
}) {
  const diagnostic = useMemo(() => {
    if (allSystemEntries.length === 0) {
      return { icon: AlertCircle, message: "Belum ada jurnal umum \u2014 buat jurnal baru?" }
    }

    const bankIsInflow = currentItem.bankAmount >= 0
    const sameDir = allSystemEntries.filter((e) => (e.amount >= 0) === bankIsInflow)

    if (sameDir.length === 0) {
      return {
        icon: ArrowRightLeft,
        message: `Semua jurnal GL berlawanan arah (bank: ${bankIsInflow ? "masuk" : "keluar"}, GL: semua ${bankIsInflow ? "keluar" : "masuk"})`,
      }
    }

    const bankDate = currentItem.bankDate ? new Date(currentItem.bankDate) : null
    if (bankDate) {
      const within30 = sameDir.filter((e) => Math.abs(new Date(e.date).getTime() - bankDate.getTime()) <= 30 * 86400000)
      if (within30.length === 0) {
        return { icon: AlertCircle, message: "Tidak ada jurnal dalam 30 hari dari tanggal bank" }
      }
    }

    const bankAbs = Math.abs(currentItem.bankAmount)
    const closest = sameDir.reduce((best, e) => {
      const diff = Math.abs(Math.abs(e.amount) - bankAbs)
      return diff < best.diff ? { diff, amount: Math.abs(e.amount) } : best
    }, { diff: Infinity, amount: 0 })

    if (closest.diff > 0 && bankAbs > 0) {
      const pct = (closest.diff / bankAbs * 100).toFixed(1)
      return {
        icon: AlertCircle,
        message: `Selisih jumlah terlalu besar \u2014 jurnal terdekat: Rp ${formatIDR(Math.round(closest.amount))} (selisih ${pct}%)`,
      }
    }

    return { icon: AlertCircle, message: "Tidak ada kecocokan ditemukan" }
  }, [currentItem, allSystemEntries])

  const Icon = diagnostic.icon
  return (
    <div className="p-8 text-center space-y-3">
      <Icon className="h-6 w-6 mx-auto text-zinc-300 mb-2" />
      <span className="text-[11px] font-bold text-zinc-500 block">Tidak ada jurnal yang cocok</span>
      <p className="text-[10px] text-zinc-400 italic">{diagnostic.message}</p>
    </div>
  )
}

// ==============================================================================
// Progress Header
// ==============================================================================

function ProgressHeader({
    detail,
    matchedCount,
    totalCount,
    isCompleted,
}: {
    detail: ReconciliationDetail
    matchedCount: number
    totalCount: number
    isCompleted: boolean
}) {
    const pct = totalCount > 0 ? (matchedCount / totalCount) * 100 : 0
    const progressColor = pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-400" : "bg-red-400"
    const statusLabel = isCompleted ? "SELESAI" : "DALAM PROSES"
    const statusColor = isCompleted
        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
        : "bg-amber-50 text-amber-700 border-amber-300"

    return (
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-orange-500 flex items-center justify-center">
                        <Landmark className="h-4.5 w-4.5 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5 mb-0.5">
                            <h2 className="text-base font-black tracking-tight text-zinc-900 dark:text-white">
                                {detail.glAccountName}
                            </h2>
                            <span className="text-[9px] font-mono font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 border border-zinc-200 dark:border-zinc-700">
                                {detail.glAccountCode}
                            </span>
                            <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 border ${statusColor}`}>
                                {statusLabel}
                            </span>
                        </div>
                        <div className="flex items-center gap-4 text-[11px]">
                            <span className="text-zinc-400 font-medium">
                                Saldo Buku: <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">Rp {formatIDR(detail.glAccountBalance)}</span>
                            </span>
                            <span className="text-zinc-300 dark:text-zinc-600">|</span>
                            <span className="text-zinc-400 font-medium">
                                Periode: <span className="font-bold text-zinc-600 dark:text-zinc-300">{formatDate(detail.periodStart)} — {formatDate(detail.periodEnd)}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            {/* Progress bar */}
            <div className="flex items-center gap-3">
                <div className="flex-1 h-2.5 bg-zinc-200/70 dark:bg-zinc-700 overflow-hidden">
                    <motion.div
                        className={`h-full ${progressColor}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(pct, 1)}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                </div>
                <span className="text-sm font-black font-mono text-zinc-700 dark:text-zinc-300 shrink-0 w-24 text-right">
                    {matchedCount}/{totalCount} <span className="text-[10px] font-bold text-zinc-400">selesai</span>
                </span>
            </div>
        </div>
    )
}

// ==============================================================================
// Queue Item Row
// ==============================================================================

function QueueItemRow({
    item,
    layer,
    isActive,
    onSelect,
    onConfirm,
    onReject,
    onIgnore,
    actionLoading,
}: {
    item: ReconciliationItemData
    layer: ReconDisplayLayer
    isActive: boolean
    onSelect: () => void
    onConfirm?: () => void
    onReject?: () => void
    onIgnore?: () => void
    actionLoading: string | null
}) {
    const cfg = LAYER_CONFIG[layer]
    const Icon = cfg.icon
    const isLoading = actionLoading === item.id

    return (
        <div
            className={`relative text-left px-3 py-2 transition-all duration-100 group ${
                isActive
                    ? `${cfg.bg} border ${cfg.border} shadow-sm`
                    : `border border-transparent hover:bg-white dark:hover:bg-zinc-800 hover:border-zinc-200`
            }`}
        >
            {isActive && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-orange-500 rounded-r" />
            )}
            <button onClick={onSelect} className="w-full text-left flex items-center gap-2.5">
                <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg.text}`} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                        <span className={`text-[11px] font-medium truncate ${
                            layer === "CONFIRMED" ? "text-zinc-500 line-through" :
                            layer === "IGNORED" ? "text-zinc-400 italic" :
                            isActive ? "text-zinc-900 font-bold" :
                            "text-zinc-700"
                        }`}>
                            {item.bankDescription || item.bankRef || "-"}
                        </span>
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                        <span className={`text-[9px] font-mono ${
                            item.bankAmount >= 0 ? "text-emerald-600" : "text-red-500"
                        }`}>
                            <span className="text-[7px]">{item.bankAmount >= 0 ? "\u25B2" : "\u25BC"}</span>{" "}
                            Rp {formatIDR(Math.abs(item.bankAmount))}
                        </span>
                        <span className={`text-[7px] font-black px-1 py-0.5 border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                            {cfg.label}
                            {item.matchScore != null && layer !== "CONFIRMED" && layer !== "IGNORED" && (
                                <span className="font-mono ml-0.5">{item.matchScore}%</span>
                            )}
                        </span>
                    </div>
                </div>
            </button>
            {(onConfirm || onReject || onIgnore) && (
                <div className={`flex gap-1 mt-1.5 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
                    {onConfirm && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onConfirm() }}
                            disabled={isLoading}
                            className="flex-1 text-[7px] font-bold uppercase px-1.5 py-1 bg-emerald-500 text-white border border-emerald-600 hover:bg-emerald-600 disabled:opacity-50"
                        >
                            {isLoading ? "..." : "Konfirmasi"}
                        </button>
                    )}
                    {onReject && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onReject() }}
                            disabled={isLoading}
                            className="flex-1 text-[7px] font-bold uppercase px-1.5 py-1 bg-white text-red-600 border border-red-300 hover:bg-red-50 disabled:opacity-50"
                        >
                            Tolak
                        </button>
                    )}
                    {onIgnore && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onIgnore() }}
                            disabled={isLoading}
                            className="flex-1 text-[7px] font-bold uppercase px-1.5 py-1 bg-white text-zinc-500 border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
                        >
                            Abaikan
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

// ==============================================================================
// Queue Sidebar (4-layer grouped)
// ==============================================================================

function QueueSidebar({
    items,
    currentIndex,
    onSelect,
    activeFilter,
    onFilterChange,
    onConfirmItem,
    onRejectItem,
    onIgnoreItem,
    onBulkConfirmCocok,
    actionLoading,
    isCompleted,
}: {
    items: ReconciliationItemData[]
    currentIndex: number
    onSelect: (index: number) => void
    activeFilter: FilterTab
    onFilterChange: (tab: FilterTab) => void
    onConfirmItem: (itemId: string) => Promise<void>
    onRejectItem: (itemId: string) => Promise<void>
    onIgnoreItem: (itemId: string) => Promise<void>
    onBulkConfirmCocok: () => Promise<void>
    actionLoading: string | null
    isCompleted: boolean
}) {
    const classified = useMemo(() => {
        const groups: Record<ReconDisplayLayer, { item: ReconciliationItemData; originalIndex: number }[]> = {
            CONFIRMED: [], COCOK: [], POTENSI: [], HAMPIR: [], BELUM: [], IGNORED: [],
        }
        items.forEach((item, idx) => {
            const layer = getItemDisplayLayer(item)
            groups[layer].push({ item, originalIndex: idx })
        })
        return groups
    }, [items])

    const tabCounts: Record<FilterTab, number> = useMemo(() => ({
        SEMUA: items.length,
        COCOK: classified.COCOK.length,
        POTENSI: classified.POTENSI.length,
        HAMPIR: classified.HAMPIR.length,
        BELUM: classified.BELUM.length,
    }), [items.length, classified])

    const displayOrder: ReconDisplayLayer[] = ["CONFIRMED", "COCOK", "POTENSI", "HAMPIR", "BELUM", "IGNORED"]
    const filteredGroups = useMemo(() => {
        if (activeFilter === "SEMUA") return displayOrder.filter(l => classified[l].length > 0)
        return displayOrder.filter(l => {
            if (l === "CONFIRMED" || l === "IGNORED") return classified[l].length > 0
            if (l === activeFilter) return classified[l].length > 0
            return false
        })
    }, [activeFilter, classified]) // eslint-disable-line react-hooks/exhaustive-deps

    const confirmedCount = classified.CONFIRMED.length + classified.IGNORED.length

    return (
        <div className="w-[300px] shrink-0 border-r border-zinc-200 dark:border-zinc-700 flex flex-col bg-zinc-50/50 dark:bg-zinc-900/50">
            {/* Header + progress */}
            <div className="px-3.5 py-2.5 border-b border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Rekonsiliasi
                    </span>
                    <span className="text-[10px] font-mono font-bold text-zinc-400">
                        {confirmedCount}/{items.length}
                    </span>
                </div>
                <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${items.length > 0 ? (confirmedCount / items.length) * 100 : 0}%` }}
                    />
                </div>
            </div>

            {/* Filter tabs */}
            <div className="px-2 py-1.5 border-b border-zinc-200 dark:border-zinc-700 flex gap-0.5 overflow-x-auto">
                {(["SEMUA", "COCOK", "POTENSI", "HAMPIR", "BELUM"] as FilterTab[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => onFilterChange(tab)}
                        className={`px-2 py-1 text-[8px] font-black uppercase tracking-wider whitespace-nowrap border transition-colors ${
                            activeFilter === tab
                                ? "bg-zinc-900 text-white border-zinc-900"
                                : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
                        }`}
                    >
                        {tab} {tabCounts[tab]}
                    </button>
                ))}
            </div>

            {/* Grouped item list */}
            <ScrollArea className="flex-1">
                <div className="p-1.5 space-y-2">
                    {filteredGroups.map(layer => {
                        const groupItems = classified[layer]
                        if (groupItems.length === 0) return null
                        const layerCfg = LAYER_CONFIG[layer]

                        return (
                            <div key={layer}>
                                <div className={`flex items-center justify-between px-2 py-1.5 ${layerCfg.headerBg} border-b border-zinc-200`}>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs">{layerCfg.headerIcon}</span>
                                        <span className={`text-[9px] font-black uppercase tracking-wider ${layerCfg.text}`}>
                                            {layerCfg.label} ({groupItems.length})
                                        </span>
                                    </div>
                                    {layer === "COCOK" && groupItems.length > 0 && !isCompleted && (
                                        <button
                                            onClick={onBulkConfirmCocok}
                                            disabled={!!actionLoading}
                                            className="text-[7px] font-bold uppercase px-1.5 py-0.5 bg-emerald-600 text-white border border-emerald-700 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                        >
                                            {actionLoading === "bulk-confirm" ? "..." : "Konfirmasi Semua"}
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-0.5">
                                    {groupItems.map(({ item, originalIndex }) => {
                                        const isActive = originalIndex === currentIndex
                                        return (
                                            <QueueItemRow
                                                key={item.id}
                                                item={item}
                                                layer={layer}
                                                isActive={isActive}
                                                onSelect={() => onSelect(originalIndex)}
                                                onConfirm={
                                                    (layer === "COCOK" || layer === "POTENSI") && !isCompleted
                                                        ? () => onConfirmItem(item.id)
                                                        : undefined
                                                }
                                                onReject={
                                                    (layer === "COCOK" || layer === "POTENSI" || layer === "CONFIRMED") && !isCompleted
                                                        ? () => onRejectItem(item.id)
                                                        : undefined
                                                }
                                                onIgnore={
                                                    layer === "BELUM" && !isCompleted
                                                        ? () => onIgnoreItem(item.id)
                                                        : undefined
                                                }
                                                actionLoading={actionLoading}
                                            />
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </ScrollArea>
        </div>
    )
}

// ==============================================================================
// Bank Line Card (Read-only display of current bank statement line)
// ==============================================================================

function BankLineCard({ item }: { item: ReconciliationItemData }) {
    return (
        <div className="border-2 border-black bg-white dark:bg-zinc-900 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            <div className="bg-sky-500 px-4 py-2 flex items-center gap-2">
                <Landmark className="h-3.5 w-3.5 text-white" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white">
                    Laporan Bank
                </span>
            </div>
            <div className="p-4 space-y-2.5">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block">Tanggal</span>
                        <span className="text-sm font-mono font-bold text-zinc-800 dark:text-zinc-200">
                            {item.bankDate ? formatDate(item.bankDate) : "-"}
                        </span>
                    </div>
                    <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block">Jumlah</span>
                        <div className="flex items-center gap-2">
                            <span className={`text-lg font-mono font-black ${
                                item.bankAmount >= 0 ? "text-emerald-600" : "text-red-600"
                            }`}>
                                Rp {formatIDR(Math.abs(item.bankAmount))}
                            </span>
                            <DirectionChip amount={item.bankAmount} />
                        </div>
                    </div>
                </div>
                <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block">Keterangan</span>
                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                        {item.bankDescription || "-"}
                    </span>
                </div>
                {item.bankRef && (
                    <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block">Referensi</span>
                        <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400">{item.bankRef}</span>
                    </div>
                )}
                {item.matchTier && (
                    <div className="flex items-center gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                        <TierBadge tier={item.matchTier} score={item.matchScore} />
                    </div>
                )}
            </div>
        </div>
    )
}

// ==============================================================================
// Journal Suggestions Panel — 3-Tier Dynamic Matching
// ==============================================================================

function JournalSuggestions({
    allSystemEntries,
    currentItem,
    selectedJournalId,
    onSelect,
    searchQuery,
    onSearchChange,
    reconciliationId,
    bankAccountCode,
    onCreateJournalAndMatch,
    onReloadDetail,
    glAccounts,
}: {
    allSystemEntries: SystemEntryData[]
    currentItem: ReconciliationItemData
    selectedJournalId: string | null
    onSelect: (id: string | null) => void
    searchQuery: string
    onSearchChange: (q: string) => void
    reconciliationId: string
    bankAccountCode: string
    onCreateJournalAndMatch?: (reconciliationId: string, bankLineId: string, journalData: { date: string; description: string; reference?: string; amount: number; debitAccountCode: string; creditAccountCode: string }) => Promise<{ success: boolean; journalId?: string; error?: string }>
    onReloadDetail: (activeBankItemId?: string) => Promise<void>
    glAccounts: { id: string; code: string; name: string; type: string }[]
}) {
    // Inline journal creation state
    const [showInlineForm, setShowInlineForm] = useState(false)
    const [inlineDebitCode, setInlineDebitCode] = useState("")
    const [inlineDescription, setInlineDescription] = useState(currentItem.bankDescription || "")
    const [inlineDate, setInlineDate] = useState(
        currentItem.bankDate ? currentItem.bankDate.slice(0, 10) : new Date().toISOString().slice(0, 10)
    )
    const [inlineRef, setInlineRef] = useState(currentItem.bankRef || "")
    const [inlineSaving, setInlineSaving] = useState(false)

    // ── 3-Tier Dynamic Matching ──────────────────────────────────────────
    const tieredMatches: TieredMatches = useMemo(() => {
        const bankLine: ClientBankLine = {
            id: currentItem.id,
            bankDate: currentItem.bankDate,
            bankAmount: currentItem.bankAmount,
            bankDescription: currentItem.bankDescription,
            bankRef: currentItem.bankRef,
        }
        return rankMatchesForBankLine(bankLine, allSystemEntries)
    }, [currentItem.id, currentItem.bankDate, currentItem.bankAmount, currentItem.bankDescription, currentItem.bankRef, allSystemEntries])

    // Filter by search query across all tiers
    const filterMatch = useCallback((m: ClientMatchResult): boolean => {
        if (!searchQuery.trim()) return true
        const q = searchQuery.toLowerCase()
        const e = m.entry
        return (
            (e.description || "").toLowerCase().includes(q) ||
            (e.lineDescription || "").toLowerCase().includes(q) ||
            (e.reference || "").toLowerCase().includes(q) ||
            String(e.amount).includes(q)
        )
    }, [searchQuery])

    const filteredAuto = tieredMatches.auto.filter(filterMatch)
    const filteredPotential = tieredMatches.potential.filter(filterMatch)
    const filteredManual = tieredMatches.manual.filter(filterMatch)
    const totalFiltered = filteredAuto.length + filteredPotential.length + filteredManual.length

    return (
        <div className="flex-1 flex flex-col min-h-0">
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-800/30">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
                        Pilih Jurnal yang Cocok
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {tieredMatches.auto.length > 0 && (
                        <span className="text-[8px] font-black px-1.5 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-400">
                            {tieredMatches.auto.length} AUTO
                        </span>
                    )}
                    {tieredMatches.potential.length > 0 && (
                        <span className="text-[8px] font-black px-1.5 py-0.5 bg-amber-100 text-amber-700 border border-amber-400">
                            {tieredMatches.potential.length} POTENSI
                        </span>
                    )}
                    <span className="text-[10px] font-mono font-bold text-zinc-400">
                        {totalFiltered} jurnal
                    </span>
                </div>
            </div>

            {/* Search */}
            <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-800">
                <div className="relative">
                    <Search className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 transition-colors ${
                        searchQuery ? "text-orange-500" : "text-zinc-400"
                    }`} />
                    <input
                        className={`w-full h-8 text-xs font-medium pl-8 pr-8 rounded-none outline-none transition-colors ${
                            searchQuery
                                ? "border border-orange-400 bg-orange-50/50 dark:bg-orange-950/20"
                                : "border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                        } placeholder:text-zinc-400 placeholder:font-normal`}
                        placeholder="Cari jurnal..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => onSearchChange("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    )}
                </div>
            </div>

            {/* Inline Journal Creation Form */}
            {showInlineForm && onCreateJournalAndMatch && (
                <InlineJournalForm
                    currentItem={currentItem}
                    bankAccountCode={bankAccountCode}
                    reconciliationId={reconciliationId}
                    glAccounts={glAccounts}
                    inlineDate={inlineDate}
                    setInlineDate={setInlineDate}
                    inlineDescription={inlineDescription}
                    setInlineDescription={setInlineDescription}
                    inlineRef={inlineRef}
                    setInlineRef={setInlineRef}
                    inlineDebitCode={inlineDebitCode}
                    setInlineDebitCode={setInlineDebitCode}
                    inlineSaving={inlineSaving}
                    setInlineSaving={setInlineSaving}
                    onCreateJournalAndMatch={onCreateJournalAndMatch}
                    onReloadDetail={onReloadDetail}
                    onClose={() => setShowInlineForm(false)}
                />
            )}

            {/* 3-Tier Journal List */}
            <ScrollArea className="flex-1">
                {totalFiltered === 0 && !showInlineForm ? (
                    <div>
                        {searchQuery ? (
                            <div className="p-8 text-center space-y-3">
                                <AlertCircle className="h-6 w-6 mx-auto text-zinc-300 mb-2" />
                                <span className="text-[11px] font-bold text-zinc-500 block">
                                    Tidak ada jurnal untuk &quot;{searchQuery}&quot;
                                </span>
                            </div>
                        ) : (
                            <ZeroMatchDiagnostic
                                currentItem={currentItem}
                                allSystemEntries={allSystemEntries}
                            />
                        )}
                        <div className="flex items-center justify-center gap-2 py-3">
                            {onCreateJournalAndMatch && (
                                <Button
                                    variant="outline"
                                    className="h-8 text-[10px] font-black uppercase tracking-wider rounded-none border-2 border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 px-4"
                                    onClick={() => {
                                        setShowInlineForm(true)
                                        setInlineDescription(currentItem.bankDescription || "")
                                        setInlineDate(currentItem.bankDate ? currentItem.bankDate.slice(0, 10) : new Date().toISOString().slice(0, 10))
                                        setInlineRef(currentItem.bankRef || "")
                                        setInlineDebitCode("")
                                    }}
                                >
                                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Buat Jurnal Baru
                                </Button>
                            )}
                        </div>
                    </div>
                ) : totalFiltered === 0 ? (
                    <div className="p-4 text-center">
                        <span className="text-[10px] font-bold text-zinc-400">Isi form di atas untuk membuat jurnal baru</span>
                    </div>
                ) : (
                    <div>
                        {/* ── TIER 1: AUTO — 100% Match ──────────────────── */}
                        {filteredAuto.length > 0 && !searchQuery && (
                            <div>
                                <div className="px-4 py-2 bg-emerald-500 flex items-center gap-2">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white">
                                        Cocok Otomatis
                                    </span>
                                    <span className="text-[9px] font-mono font-bold text-emerald-200 ml-auto">
                                        {filteredAuto[0]?.score ?? 100}% kecocokan
                                    </span>
                                </div>
                                {filteredAuto.map((m) => (
                                    <AutoMatchCard
                                        key={m.entryId}
                                        match={m}
                                        isSelected={selectedJournalId === m.entryId}
                                        onSelect={() => onSelect(selectedJournalId === m.entryId ? null : m.entryId)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* ── TIER 2: POTENTIAL — Fuzzy Match ────────────── */}
                        {filteredPotential.length > 0 && (
                            <div>
                                {/* Only show header if not searching */}
                                {!searchQuery && (
                                    <div className="px-4 py-2 bg-amber-100 dark:bg-amber-900/30 border-b border-amber-300 dark:border-amber-700 flex items-center gap-2">
                                        <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
                                            Potensi Cocok
                                        </span>
                                        <span className="text-[9px] font-mono font-bold text-amber-500 ml-auto">
                                            {filteredPotential.length} saran
                                        </span>
                                    </div>
                                )}
                                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {filteredPotential.map((m) => (
                                        <MatchRow
                                            key={m.entryId}
                                            match={m}
                                            isSelected={selectedJournalId === m.entryId}
                                            onSelect={() => onSelect(selectedJournalId === m.entryId ? null : m.entryId)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── TIER 3: MANUAL — All Journals ──────────────── */}
                        {filteredManual.length > 0 && (
                            <div>
                                {!searchQuery && (filteredAuto.length > 0 || filteredPotential.length > 0) && (
                                    <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-2">
                                        <Search className="h-3.5 w-3.5 text-zinc-400" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                                            Pilih Manual
                                        </span>
                                        <span className="text-[9px] font-mono font-bold text-zinc-400 ml-auto">
                                            {filteredManual.length} jurnal
                                        </span>
                                    </div>
                                )}
                                {/* Show header when no AUTO or POTENTIAL */}
                                {!searchQuery && filteredAuto.length === 0 && filteredPotential.length === 0 && (
                                    <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800 flex items-center gap-2">
                                        <Search className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-400">
                                            Pilih Manual
                                        </span>
                                        <span className="text-[9px] text-blue-500 dark:text-blue-400 ml-2 font-medium">
                                            Tidak ada kecocokan otomatis. Pilih jurnal yang tepat.
                                        </span>
                                    </div>
                                )}
                                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {filteredManual.map((m) => (
                                        <MatchRow
                                            key={m.entryId}
                                            match={m}
                                            isSelected={selectedJournalId === m.entryId}
                                            onSelect={() => onSelect(selectedJournalId === m.entryId ? null : m.entryId)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Footer: Create journal button */}
                        {onCreateJournalAndMatch && !showInlineForm && (
                            <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-700">
                                <button
                                    className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 uppercase tracking-wider"
                                    onClick={() => {
                                        setShowInlineForm(true)
                                        setInlineDescription(currentItem.bankDescription || "")
                                        setInlineDate(currentItem.bankDate ? currentItem.bankDate.slice(0, 10) : new Date().toISOString().slice(0, 10))
                                        setInlineRef(currentItem.bankRef || "")
                                        setInlineDebitCode("")
                                    }}
                                >
                                    <Plus className="h-3 w-3" /> Buat jurnal baru
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </ScrollArea>
        </div>
    )
}

// ==============================================================================
// Auto Match Card (Tier 1 — green banner, one-click match)
// ==============================================================================

function AutoMatchCard({
    match,
    isSelected,
    onSelect,
}: {
    match: ClientMatchResult
    isSelected: boolean
    onSelect: () => void
}) {
    const e = match.entry
    return (
        <button
            className={`w-full text-left px-4 py-3.5 transition-all duration-100 border-b border-emerald-200 dark:border-emerald-800 ${
                isSelected
                    ? "bg-emerald-100 dark:bg-emerald-950/30 border-l-[3px] border-l-emerald-600"
                    : "bg-emerald-50/50 dark:bg-emerald-950/10 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/20 border-l-[3px] border-l-transparent"
            }`}
            onClick={onSelect}
        >
            <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[9px] font-mono text-emerald-500 shrink-0">
                        {formatDate(e.date)}
                    </span>
                    <TierBadge tier="AUTO" score={match.score} />
                </div>
                <span className={`text-sm font-mono font-black shrink-0 ${
                    e.amount >= 0 ? "text-emerald-600" : "text-red-600"
                }`}>
                    Rp {formatIDR(Math.abs(e.amount))}
                    <span className="text-[8px] font-black ml-1 opacity-60">
                        {e.amount >= 0 ? "DR" : "CR"}
                    </span>
                </span>
            </div>
            <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
                <HighlightedText text={e.lineDescription || e.description || "-"} matchedRefs={match.matchedRefs} />
            </div>
            {e.reference && (
                <div className="text-[9px] text-emerald-500 font-mono truncate mt-0.5">
                    Ref: <HighlightedText text={e.reference} matchedRefs={match.matchedRefs} />
                </div>
            )}
            <SignalBar signals={match.signals} score={match.score} />
            {isSelected ? (
                <div className="mt-2 flex items-center gap-1.5 text-[9px] font-bold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" />
                    Dipilih — klik &quot;Cocokkan & Lanjut&quot;
                </div>
            ) : (
                <div className="mt-2 text-[9px] font-bold text-emerald-600 uppercase tracking-wider">
                    Klik untuk pilih → Cocokkan Sekarang
                </div>
            )}
        </button>
    )
}

// ==============================================================================
// Match Row (Tier 2 & 3 — standard row with score details)
// ==============================================================================

function MatchRow({
    match,
    isSelected,
    onSelect,
}: {
    match: ClientMatchResult
    isSelected: boolean
    onSelect: () => void
}) {
    const e = match.entry
    const isPotential = match.tier === "POTENTIAL"

    return (
        <button
            className={`w-full text-left px-4 py-3 transition-all duration-100 ${
                isSelected
                    ? "bg-orange-50 dark:bg-orange-950/20 border-l-[3px] border-l-orange-500"
                    : isPotential
                        ? "hover:bg-amber-50/50 dark:hover:bg-amber-950/10 border-l-[3px] border-l-amber-300"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800 border-l-[3px] border-l-transparent"
            }`}
            onClick={onSelect}
        >
            <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[9px] font-mono text-zinc-400 shrink-0">
                        {formatDate(e.date)}
                    </span>
                    <TierBadge tier={match.tier} score={match.score} />
                </div>
                <span className={`text-sm font-mono font-bold shrink-0 ${
                    e.amount >= 0 ? "text-emerald-600" : "text-red-600"
                }`}>
                    Rp {formatIDR(Math.abs(e.amount))}
                    <span className="text-[8px] font-black ml-1 opacity-60">
                        {e.amount >= 0 ? "DR" : "CR"}
                    </span>
                </span>
            </div>
            <div className="text-xs font-medium truncate text-zinc-700 dark:text-zinc-300">
                <HighlightedText text={e.lineDescription || e.description || "-"} matchedRefs={match.matchedRefs} />
            </div>
            {e.reference && (
                <div className="text-[9px] text-zinc-400 font-mono truncate mt-0.5">
                    Ref: <HighlightedText text={e.reference} matchedRefs={match.matchedRefs} />
                </div>
            )}
            <SignalBar signals={match.signals} score={match.score} />
            <div className="flex items-center gap-2.5 mt-1 text-[8px] text-zinc-400">
                {match.amountDiff === 0 ? (
                    <span className="text-emerald-500 font-bold">Jumlah cocok</span>
                ) : (
                    <span>Selisih <span className="font-mono font-bold text-zinc-500">Rp {formatIDR(Math.round(match.amountDiff))}</span></span>
                )}
                {match.matchedRefs.length > 0 && (
                    <span className="text-orange-600 font-bold">Ref {"\u2713"}</span>
                )}
                {match.daysDiff > 0 && (
                    <span>{"\u00b1"}{match.daysDiff} hari</span>
                )}
            </div>
            {isSelected && (
                <div className="mt-2 flex items-center gap-1.5 text-[9px] font-bold text-orange-600">
                    <CheckCircle2 className="h-3 w-3" />
                    Jurnal ini dipilih — klik &quot;Cocokkan & Lanjut&quot;
                </div>
            )}
        </button>
    )
}

// ==============================================================================
// Inline Journal Creation Form (extracted for cleanliness)
// ==============================================================================

function InlineJournalForm({
    currentItem,
    bankAccountCode,
    reconciliationId,
    glAccounts,
    inlineDate,
    setInlineDate,
    inlineDescription,
    setInlineDescription,
    inlineRef,
    setInlineRef,
    inlineDebitCode,
    setInlineDebitCode,
    inlineSaving,
    setInlineSaving,
    onCreateJournalAndMatch,
    onReloadDetail,
    onClose,
}: {
    currentItem: ReconciliationItemData
    bankAccountCode: string
    reconciliationId: string
    glAccounts: { id: string; code: string; name: string; type: string }[]
    inlineDate: string
    setInlineDate: (v: string) => void
    inlineDescription: string
    setInlineDescription: (v: string) => void
    inlineRef: string
    setInlineRef: (v: string) => void
    inlineDebitCode: string
    setInlineDebitCode: (v: string) => void
    inlineSaving: boolean
    setInlineSaving: (v: boolean) => void
    onCreateJournalAndMatch: (reconciliationId: string, bankLineId: string, journalData: { date: string; description: string; reference?: string; amount: number; debitAccountCode: string; creditAccountCode: string }) => Promise<{ success: boolean; journalId?: string; error?: string }>
    onReloadDetail: (activeBankItemId?: string) => Promise<void>
    onClose: () => void
}) {
    return (
        <div className="border-b-2 border-amber-300 bg-amber-50/30 dark:bg-amber-950/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Plus className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
                        Buat Jurnal Umum Baru
                    </span>
                </div>
                <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>

            <div className="space-y-2.5 bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800 p-3">
                <div className="grid grid-cols-[140px_1fr] gap-2">
                    <div>
                        <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Tanggal</label>
                        <input
                            type="date"
                            value={inlineDate}
                            onChange={(e) => setInlineDate(e.target.value)}
                            className="w-full h-8 text-xs font-mono px-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 rounded-none outline-none focus:border-orange-400"
                        />
                    </div>
                    <div>
                        <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Keterangan</label>
                        <input
                            value={inlineDescription}
                            onChange={(e) => setInlineDescription(e.target.value)}
                            placeholder="Keterangan jurnal..."
                            className="w-full h-8 text-xs px-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 rounded-none outline-none focus:border-orange-400"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-[140px_1fr] gap-2">
                    <div>
                        <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Jumlah (IDR)</label>
                        <div className={`h-8 flex items-center px-2 text-xs font-mono font-bold border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 ${
                            currentItem.bankAmount >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}>
                            Rp {formatIDR(Math.abs(currentItem.bankAmount))}
                        </div>
                    </div>
                    <div>
                        <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Referensi</label>
                        <input
                            value={inlineRef}
                            onChange={(e) => setInlineRef(e.target.value)}
                            placeholder="REF-001"
                            className="w-full h-8 text-xs font-mono px-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 rounded-none outline-none focus:border-orange-400"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                            Akun Debit <span className="text-red-500">*</span>
                        </label>
                        <Select value={inlineDebitCode} onValueChange={setInlineDebitCode}>
                            <SelectTrigger className="h-8 text-xs rounded-none border-zinc-300 dark:border-zinc-600">
                                <SelectValue placeholder="Pilih akun debit..." />
                            </SelectTrigger>
                            <SelectContent>
                                {glAccounts.map((acc) => (
                                    <SelectItem key={acc.id} value={acc.code}>
                                        {acc.code} — {acc.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                            Akun Kredit
                        </label>
                        <div className="h-8 flex items-center px-2 text-xs font-mono border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            {bankAccountCode} — Akun Bank
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                        variant="ghost"
                        className="h-8 text-[10px] font-bold uppercase tracking-wider rounded-none px-3 text-zinc-500"
                        onClick={onClose}
                    >
                        Batal
                    </Button>
                    <Button
                        className="h-8 text-[10px] font-black uppercase tracking-wider rounded-none px-4 bg-orange-500 hover:bg-orange-600 text-white border-2 border-orange-600 disabled:opacity-40"
                        disabled={!inlineDebitCode || !inlineDescription.trim() || inlineSaving}
                        onClick={async () => {
                            if (!inlineDebitCode || !inlineDescription.trim()) return
                            setInlineSaving(true)
                            try {
                                const result = await onCreateJournalAndMatch(
                                    reconciliationId,
                                    currentItem.id,
                                    {
                                        date: new Date(inlineDate).toISOString(),
                                        description: inlineDescription.trim(),
                                        reference: inlineRef.trim() || undefined,
                                        amount: Math.abs(currentItem.bankAmount),
                                        debitAccountCode: inlineDebitCode,
                                        creditAccountCode: bankAccountCode,
                                    }
                                )
                                if (result.success) {
                                    toast.success("Jurnal dibuat & dicocokkan")
                                    onClose()
                                    await onReloadDetail(currentItem.id)
                                } else {
                                    toast.error(result.error || "Gagal membuat jurnal")
                                }
                            } catch {
                                toast.error("Gagal membuat jurnal")
                            } finally {
                                setInlineSaving(false)
                            }
                        }}
                    >
                        {inlineSaving ? (
                            <><Loader2 className="h-3 w-3 animate-spin mr-1.5" /> Menyimpan...</>
                        ) : (
                            <><Save className="h-3 w-3 mr-1.5" /> Simpan & Cocokkan</>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}

// ==============================================================================
// Matched Item View (when viewing an already matched item)
// ==============================================================================

function MatchedItemView({
    item,
    matchedEntry,
    isCompleted,
    onUnmatch,
    actionLoading,
}: {
    item: ReconciliationItemData
    matchedEntry: SystemEntryData | undefined
    isCompleted: boolean
    onUnmatch: () => void
    actionLoading: string | null
}) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="max-w-md text-center space-y-4">
                <div className="w-14 h-14 mx-auto bg-emerald-100 dark:bg-emerald-900/30 border-2 border-emerald-300 dark:border-emerald-700 flex items-center justify-center">
                    <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">
                        Item Sudah Dicocokkan
                    </h3>
                    <p className="text-xs text-zinc-500">
                        {item.bankDescription || "-"} — Rp {formatIDR(Math.abs(item.bankAmount))}
                    </p>
                </div>
                {matchedEntry && (
                    <div className="border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/10 p-3 text-left">
                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 block mb-1">
                            Dicocokkan dengan:
                        </span>
                        <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            {matchedEntry.lineDescription || matchedEntry.description}
                        </div>
                        {matchedEntry.reference && (
                            <div className="text-[9px] text-zinc-400 font-mono mt-0.5">Ref: {matchedEntry.reference}</div>
                        )}
                        <div className={`text-sm font-mono font-bold mt-1 ${
                            matchedEntry.amount >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}>
                            Rp {formatIDR(Math.abs(matchedEntry.amount))}
                        </div>
                    </div>
                )}
                {!isCompleted && (
                    <Button
                        variant="outline"
                        className="border border-red-300 text-red-500 text-[10px] font-black uppercase h-8 px-4 rounded-none hover:bg-red-50"
                        disabled={actionLoading === `unmatch-${item.id}`}
                        onClick={onUnmatch}
                    >
                        {actionLoading === `unmatch-${item.id}` ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                        ) : (
                            <Unlink className="h-3 w-3 mr-1.5" />
                        )}
                        Batalkan Pencocokan
                    </Button>
                )}
            </div>
        </div>
    )
}

// ==============================================================================
// Completion Screen
// ==============================================================================

function CompletionScreen({
    matchedCount,
    detail,
    onClose,
    actionLoading,
    isCompleted,
}: {
    matchedCount: number
    detail: ReconciliationDetail
    onClose: () => Promise<void>
    actionLoading: string | null
    isCompleted: boolean
}) {
    const unmatchedCount = detail.items.filter(i => i.matchStatus === "UNMATCHED").length

    // Balance calculation
    const bookBalance = detail.bookBalanceSnapshot ?? detail.glAccountBalance
    const unmatchedItems = detail.items.filter(i => i.matchStatus === "UNMATCHED")
    const outDeposits = unmatchedItems.filter(i => i.bankAmount > 0).reduce((s, i) => s + i.bankAmount, 0)
    const outChecks = unmatchedItems.filter(i => i.bankAmount < 0).reduce((s, i) => s + i.bankAmount, 0)
    const adjustedBook = bookBalance + outDeposits + outChecks
    const bsBalance = detail.bankStatementBalance ?? 0
    const diff = adjustedBook - bsBalance
    const isBalanced = detail.bankStatementBalance != null ? Math.abs(diff) < 1 : true

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-10">
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="max-w-md text-center space-y-6"
            >
                <div className="w-20 h-20 mx-auto bg-emerald-100 dark:bg-emerald-900/30 border-2 border-emerald-400 flex items-center justify-center">
                    <Trophy className="h-10 w-10 text-emerald-600" />
                </div>
                <div>
                    <h2 className="text-lg font-black uppercase tracking-wider text-zinc-900 dark:text-white mb-1">
                        {isCompleted ? "Rekonsiliasi Selesai" : unmatchedCount === 0 ? "Semua Item Selesai!" : "Progres Rekonsiliasi"}
                    </h2>
                    <p className="text-xs text-zinc-500">
                        {isCompleted
                            ? "Rekonsiliasi telah ditutup dan jurnal penyesuaian telah diposting."
                            : unmatchedCount === 0
                                ? "Semua item bank telah dicocokkan."
                                : `Masih ada ${unmatchedCount} item yang belum dicocokkan.`
                        }
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="border-2 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 p-3">
                        <span className="text-2xl font-black text-emerald-600 font-mono block">{matchedCount}</span>
                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600">Cocok</span>
                    </div>
                    <div className={`border-2 p-3 ${
                        isBalanced
                            ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20"
                            : "border-red-300 bg-red-50 dark:bg-red-950/20"
                    }`}>
                        <span className={`text-2xl font-black font-mono block ${
                            isBalanced ? "text-emerald-600" : "text-red-600"
                        }`}>
                            {detail.bankStatementBalance != null ? `Rp ${formatIDR(Math.abs(diff))}` : "-"}
                        </span>
                        <span className={`text-[9px] font-black uppercase tracking-wider ${
                            isBalanced ? "text-emerald-600" : "text-red-600"
                        }`}>
                            Selisih
                        </span>
                    </div>
                </div>

                {/* Close button — only if all items done, not yet completed, and balanced */}
                {!isCompleted && unmatchedCount === 0 && (
                    <Button
                        className={isBalanced ? NB.submitBtnGreen + " w-full" : NB.submitBtn + " w-full opacity-50 cursor-not-allowed"}
                        disabled={!isBalanced || actionLoading === "close"}
                        onClick={onClose}
                    >
                        {actionLoading === "close" ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Menutup...</>
                        ) : (
                            <><Lock className="h-3.5 w-3.5 mr-1.5" /> Tutup Rekonsiliasi</>
                        )}
                    </Button>
                )}
                {!isCompleted && unmatchedCount === 0 && !isBalanced && detail.bankStatementBalance != null && (
                    <p className="text-[10px] text-red-500 font-bold">
                        Selisih Rp {formatIDR(Math.abs(diff))} — saldo buku dan bank belum seimbang
                    </p>
                )}
            </motion.div>
        </div>
    )
}

// ==============================================================================
// Main Component: ReconciliationFocusView
// ==============================================================================

export function ReconciliationFocusView({
    detail,
    isCompleted,
    actionLoading,
    onMatchItem,
    onUnmatchItem,
    onAutoMatch,
    onClose,
    onReloadDetail,
    onUpdateMeta,
    downloadTemplateCSV,
    fileInputRef,
    parsedRows,
    dragging,
    onFileChange,
    onDragOver,
    onDragLeave,
    onDrop,
    onImportParsed,
    onClearParsed,
    editBankStatementBalance,
    setEditBankStatementBalance,
    editNotes,
    setEditNotes,
    onConfirmItem,
    onRejectItem,
    onIgnoreItem,
    onBulkConfirmCocok,
    onSearchJournals,
    onCreateJournalAndMatch,
    glAccounts = [],
}: ReconciliationFocusViewProps) {
    const allItems = detail.items
    const unmatchedSystemEntries = detail.systemEntries.filter(e => e.alreadyMatchedItemId === null)

    // Focus state
    const [currentIndex, setCurrentIndex] = useState(() => {
        // Start at first unmatched item
        const firstUnmatched = allItems.findIndex(i => i.matchStatus === "UNMATCHED")
        return firstUnmatched >= 0 ? firstUnmatched : 0
    })
    const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null)
    const [journalSearchQuery, setJournalSearchQuery] = useState("")
    const [activeFilter, setActiveFilter] = useState<FilterTab>("SEMUA")

    // Derived
    const currentItem = allItems[currentIndex] ?? null
    const confirmedCount = allItems.filter(i =>
        i.matchStatus === "CONFIRMED" || i.matchStatus === "IGNORED"
    ).length
    const matchedCount = allItems.filter(i =>
        i.matchStatus === "MATCHED" || i.matchStatus === "CONFIRMED"
    ).length
    const totalCount = allItems.length
    const allDone = allItems.every(i =>
        i.matchStatus === "CONFIRMED" || i.matchStatus === "IGNORED"
    )

    // Reload detail with active bank item context when navigating between items
    const isInitialMount = useRef(true)
    const prevItemIdRef = useRef<string | null>(currentItem?.id ?? null)
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false
            // Trigger initial load with active item context
            if (currentItem?.matchStatus === "UNMATCHED") {
                onReloadDetail(currentItem.id)
            }
            return
        }
        if (currentItem && currentItem.id !== prevItemIdRef.current) {
            prevItemIdRef.current = currentItem.id
            onReloadDetail(currentItem.id)
        }
    }, [currentItem?.id]) // eslint-disable-line react-hooks/exhaustive-deps

    // Find matched entry for current item (if it's matched)
    const matchedEntry = useMemo(() => {
        if (!currentItem || currentItem.matchStatus !== "MATCHED") return undefined
        return detail.systemEntries.find(e => e.alreadyMatchedItemId === currentItem.id)
    }, [currentItem, detail.systemEntries])

    // Navigation
    const findNextUnmatched = useCallback((fromIndex: number): number => {
        for (let i = fromIndex + 1; i < allItems.length; i++) {
            if (allItems[i].matchStatus === "UNMATCHED") return i
        }
        // Wrap around
        for (let i = 0; i < fromIndex; i++) {
            if (allItems[i].matchStatus === "UNMATCHED") return i
        }
        return fromIndex
    }, [allItems])

    const goTo = useCallback((idx: number) => {
        if (idx >= 0 && idx < allItems.length) {
            setCurrentIndex(idx)
            setSelectedJournalId(null)
            setJournalSearchQuery("")
        }
    }, [allItems.length])

    const goPrev = useCallback(() => {
        goTo(Math.max(0, currentIndex - 1))
    }, [currentIndex, goTo])

    const goNext = useCallback(() => {
        goTo(Math.min(allItems.length - 1, currentIndex + 1))
    }, [currentIndex, allItems.length, goTo])

    // Match and advance
    const handleMatchAndNext = useCallback(async () => {
        if (!currentItem || !selectedJournalId) return
        await onMatchItem(currentItem.id, selectedJournalId)
        setSelectedJournalId(null)
        setJournalSearchQuery("")
        // After reload, advance to next unmatched
        const nextIdx = findNextUnmatched(currentIndex)
        setCurrentIndex(nextIdx)
        const nextItem = allItems[nextIdx]
        await onReloadDetail(nextItem?.id)
    }, [currentItem, selectedJournalId, currentIndex, allItems, onMatchItem, onReloadDetail, findNextUnmatched])

    // Unmatch handler
    const handleUnmatch = useCallback(async () => {
        if (!currentItem) return
        await onUnmatchItem(currentItem.id)
        await onReloadDetail(currentItem.id)
    }, [currentItem, onUnmatchItem, onReloadDetail])

    // No items yet — show upload prompt
    if (allItems.length === 0) {
        return (
            <div className="flex-1 flex flex-col">
                <ProgressHeader
                    detail={detail}
                    matchedCount={0}
                    totalCount={0}
                    isCompleted={isCompleted}
                />
                {/* Action bar */}
                {!isCompleted && (
                    <div className="px-5 py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-800/30">
                        <div className="flex items-center gap-0">
                            <Button
                                variant="outline"
                                size="sm"
                                className={NB.toolbarBtn}
                                onClick={downloadTemplateCSV}
                            >
                                <Download className="h-3 w-3 mr-1.5" /> Template CSV
                            </Button>
                        </div>
                    </div>
                )}
                {/* File upload zone */}
                {!isCompleted && (
                    <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                        {parsedRows ? (
                            <ParsedRowsPreview
                                rows={parsedRows}
                                onClear={onClearParsed}
                                onImport={onImportParsed}
                                actionLoading={actionLoading}
                            />
                        ) : (
                            <DropZone
                                fileInputRef={fileInputRef}
                                dragging={dragging}
                                onFileChange={onFileChange}
                                onDragOver={onDragOver}
                                onDragLeave={onDragLeave}
                                onDrop={onDrop}
                            />
                        )}
                    </div>
                )}
                <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                    <UploadCloud className="h-10 w-10 text-zinc-300 mb-3" />
                    <h3 className="text-sm font-black uppercase tracking-wider mb-1">Belum Ada Data Bank</h3>
                    <p className="text-[11px] text-zinc-400 max-w-xs">
                        Upload file mutasi bank (CSV/Excel) untuk memulai proses rekonsiliasi
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col">
            {/* Progress Header */}
            <ProgressHeader
                detail={detail}
                matchedCount={confirmedCount}
                totalCount={totalCount}
                isCompleted={isCompleted}
            />

            {/* Editable meta: bank statement balance */}
            {!isCompleted && (
                <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1 block">
                                Saldo Bank Statement
                            </label>
                            <div className="relative">
                                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold pointer-events-none transition-colors ${
                                    editBankStatementBalance ? "text-orange-500" : "text-zinc-400"
                                }`}>Rp</span>
                                <input
                                    inputMode="numeric"
                                    placeholder="0"
                                    value={editBankStatementBalance ? Number(editBankStatementBalance).toLocaleString("id-ID") : ""}
                                    onChange={(e) => {
                                        const raw = e.target.value.replace(/[^\d]/g, "")
                                        setEditBankStatementBalance(raw)
                                    }}
                                    onKeyDown={(e) => {
                                        const allowed = ["Backspace", "Delete", "Tab", "Escape", "Enter", "ArrowLeft", "ArrowRight", "Home", "End"]
                                        if (allowed.includes(e.key)) return
                                        if ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x"].includes(e.key.toLowerCase())) return
                                        if (!/^\d$/.test(e.key)) e.preventDefault()
                                    }}
                                    onBlur={async () => {
                                        const val = Number(editBankStatementBalance) || 0
                                        if (val === (detail.bankStatementBalance ?? 0)) return
                                        await onUpdateMeta({ bankStatementBalance: val })
                                    }}
                                    className={`w-full pl-10 pr-3 h-9 font-mono font-bold text-sm rounded-none outline-none transition-colors ${
                                        editBankStatementBalance
                                            ? "border border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 text-zinc-900 dark:text-white"
                                            : "border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                                    } placeholder:text-zinc-300 dark:placeholder:text-zinc-600 placeholder:font-normal focus:border-orange-400 focus:ring-1 focus:ring-orange-100 dark:focus:ring-orange-900/30`}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1 block">
                                Catatan
                            </label>
                            <input
                                placeholder="Catatan rekonsiliasi..."
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                onBlur={async () => {
                                    if (editNotes === (detail.notes ?? "")) return
                                    await onUpdateMeta({ notes: editNotes })
                                }}
                                className={`w-full h-9 text-xs font-medium px-3 rounded-none transition-colors ${
                                    editNotes
                                        ? "border border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20"
                                        : "border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                                } placeholder:text-zinc-300 dark:placeholder:text-zinc-600 placeholder:font-normal`}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Action bar */}
            {!isCompleted && (
                <div className="px-5 py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-800/30">
                    <div className="flex items-center gap-0">
                        <Button
                            variant="outline"
                            size="sm"
                            className={NB.toolbarBtn + " " + NB.toolbarBtnJoin}
                            disabled={actionLoading !== null}
                            onClick={onAutoMatch}
                        >
                            {actionLoading === "automatch" ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                            ) : (
                                <Wand2 className="h-3 w-3 mr-1.5" />
                            )}
                            {actionLoading === "automatch" ? "Mencocokkan..." : "Auto-Match"}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className={NB.toolbarBtn}
                            onClick={downloadTemplateCSV}
                        >
                            <Download className="h-3 w-3 mr-1.5" /> Template CSV
                        </Button>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-[10px] font-bold uppercase tracking-wider h-9 px-3.5 rounded-none hover:bg-red-100 dark:hover:bg-red-950/50 hover:text-red-700 dark:hover:text-red-300 transition-colors disabled:opacity-40"
                        disabled={actionLoading !== null || !allDone}
                        onClick={onClose}
                    >
                        {actionLoading === "close" ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                        ) : (
                            <Lock className="h-3 w-3 mr-1.5" />
                        )}
                        Tutup Rekonsiliasi
                    </Button>
                </div>
            )}

            {/* File upload zone */}
            {!isCompleted && (parsedRows || allItems.length === 0) && (
                <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    {parsedRows ? (
                        <ParsedRowsPreview
                            rows={parsedRows}
                            onClear={onClearParsed}
                            onImport={onImportParsed}
                            actionLoading={actionLoading}
                        />
                    ) : (
                        <DropZone
                            fileInputRef={fileInputRef}
                            dragging={dragging}
                            onFileChange={onFileChange}
                            onDragOver={onDragOver}
                            onDragLeave={onDragLeave}
                            onDrop={onDrop}
                        />
                    )}
                </div>
            )}

            {/* Main content area: Queue Sidebar + Focus Panel */}
            {allDone && !currentItem?.matchStatus?.includes("UNMATCHED") ? (
                // All done — show completion
                <CompletionScreen
                    matchedCount={matchedCount}
                    detail={detail}
                    onClose={onClose}
                    actionLoading={actionLoading}
                    isCompleted={isCompleted}
                />
            ) : (
                <div className="flex-1 flex min-h-0 overflow-hidden">
                    {/* Queue Sidebar */}
                    <QueueSidebar
                        items={allItems}
                        currentIndex={currentIndex}
                        onSelect={goTo}
                        activeFilter={activeFilter}
                        onFilterChange={setActiveFilter}
                        onConfirmItem={onConfirmItem}
                        onRejectItem={onRejectItem}
                        onIgnoreItem={(id) => onIgnoreItem(id)}
                        onBulkConfirmCocok={onBulkConfirmCocok}
                        actionLoading={actionLoading}
                        isCompleted={isCompleted}
                    />

                    {/* Focus Panel */}
                    <div className="flex-1 min-w-0 flex flex-col">
                        {currentItem && (
                            <>
                                {/* Item navigation */}
                                <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between bg-white dark:bg-zinc-900">
                                    <button
                                        onClick={goPrev}
                                        disabled={currentIndex <= 0}
                                        className="h-7 w-7 flex items-center justify-center border border-zinc-300 dark:border-zinc-700 rounded-none disabled:opacity-30 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                                            Item {currentIndex + 1} dari {allItems.length}
                                        </span>
                                        {/* Dot indicators */}
                                        <div className="flex items-center gap-0.5">
                                            {allItems.map((item, idx) => {
                                                const isMatch = item.matchStatus === "MATCHED"
                                                const isCurrent = idx === currentIndex
                                                return (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => goTo(idx)}
                                                        className={`h-2 transition-all rounded-full ${
                                                            isCurrent
                                                                ? "w-5 bg-orange-500"
                                                                : isMatch
                                                                    ? "w-2 bg-emerald-500"
                                                                    : "w-2 bg-zinc-200 dark:bg-zinc-700"
                                                        }`}
                                                        title={item.bankDescription || `Item ${idx + 1}`}
                                                    />
                                                )
                                            })}
                                        </div>
                                    </div>
                                    <button
                                        onClick={goNext}
                                        disabled={currentIndex >= allItems.length - 1}
                                        className="h-7 w-7 flex items-center justify-center border border-zinc-300 dark:border-zinc-700 rounded-none disabled:opacity-30 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>

                                {/* Focus content — depends on item status */}
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={currentItem.id}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ duration: 0.15 }}
                                        className="flex-1 flex flex-col min-h-0 overflow-hidden"
                                    >
                                        {currentItem.matchStatus === "MATCHED" ? (
                                            <MatchedItemView
                                                item={currentItem}
                                                matchedEntry={matchedEntry}
                                                isCompleted={isCompleted}
                                                onUnmatch={handleUnmatch}
                                                actionLoading={actionLoading}
                                            />
                                        ) : (
                                            /* UNMATCHED — the main focus flow */
                                            <div className="flex-1 flex flex-col min-h-0">
                                                {/* Bank line card */}
                                                <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                                                    <BankLineCard item={currentItem} />
                                                </div>

                                                {/* Journal suggestions */}
                                                <JournalSuggestions
                                                    allSystemEntries={unmatchedSystemEntries}
                                                    currentItem={currentItem}
                                                    selectedJournalId={selectedJournalId}
                                                    onSelect={setSelectedJournalId}
                                                    searchQuery={journalSearchQuery}
                                                    onSearchChange={setJournalSearchQuery}
                                                    reconciliationId={detail.id}
                                                    bankAccountCode={detail.glAccountCode}
                                                    onCreateJournalAndMatch={onCreateJournalAndMatch}
                                                    onReloadDetail={onReloadDetail}
                                                    glAccounts={glAccounts}
                                                />

                                                {/* Action buttons */}
                                                {!isCompleted && (
                                                    <div className="border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-3.5 flex items-center justify-between">
                                                        <Button
                                                            variant="outline"
                                                            className="border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-[10px] font-bold uppercase tracking-wider h-9 px-4 rounded-none"
                                                            onClick={goPrev}
                                                            disabled={currentIndex <= 0}
                                                        >
                                                            <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Sebelumnya
                                                        </Button>
                                                        <div className="flex items-center gap-3">
                                                            {selectedJournalId && (
                                                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                                    <CheckCircle2 className="h-3.5 w-3.5" /> Jurnal dipilih
                                                                </span>
                                                            )}
                                                            <Button
                                                                className="bg-orange-500 hover:bg-orange-600 text-white border-2 border-orange-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-[10px] tracking-wider px-5 h-9 rounded-none disabled:opacity-40 disabled:cursor-not-allowed"
                                                                disabled={!selectedJournalId || actionLoading !== null}
                                                                onClick={handleMatchAndNext}
                                                            >
                                                                {actionLoading === "match" ? (
                                                                    <><Loader2 className="h-3 w-3 animate-spin mr-1.5" /> Mencocokkan...</>
                                                                ) : (
                                                                    <>Cocokkan & Lanjut <ChevronRight className="h-3.5 w-3.5 ml-1" /></>
                                                                )}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </motion.div>
                                </AnimatePresence>
                            </>
                        )}
                    </div>
                </div>
            )}

        </div>
    )
}

// ==============================================================================
// Small helper sub-components (file upload)
// ==============================================================================

function ParsedRowsPreview({
    rows,
    onClear,
    onImport,
    actionLoading,
}: {
    rows: { date: string; description: string; amount: number; reference?: string }[]
    onClear: () => void
    onImport: () => Promise<void>
    actionLoading: string | null
}) {
    return (
        <div className="border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center h-7 w-7 bg-emerald-100 border border-emerald-300">
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 block">
                            {rows.length} baris siap diimpor
                        </span>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[9px] font-bold text-emerald-600">
                                Masuk: Rp {formatIDR(rows.filter(r => r.amount > 0).reduce((s, r) => s + r.amount, 0))}
                            </span>
                            <span className="text-[9px] font-bold text-red-600">
                                Keluar: Rp {formatIDR(Math.abs(rows.filter(r => r.amount < 0).reduce((s, r) => s + r.amount, 0)))}
                            </span>
                        </div>
                    </div>
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-emerald-100" onClick={onClear}>
                    <X className="h-3.5 w-3.5" />
                </Button>
            </div>
            <div className="max-h-24 overflow-y-auto text-[9px] font-mono text-zinc-600 dark:text-zinc-400 space-y-0.5 mb-3 bg-white dark:bg-zinc-900 p-2 border border-emerald-200 dark:border-emerald-800">
                {rows.slice(0, 5).map((r, i) => (
                    <div key={i} className="flex justify-between gap-2">
                        <span className="text-zinc-400 shrink-0">{r.date}</span>
                        <span className="truncate flex-1">{r.description}</span>
                        <span className={`shrink-0 font-bold ${r.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            Rp {formatIDR(Math.abs(r.amount))}
                        </span>
                    </div>
                ))}
                {rows.length > 5 && (
                    <div className="text-zinc-400 text-center">...dan {rows.length - 5} baris lainnya</div>
                )}
            </div>
            <Button
                className={NB.submitBtn + " w-full"}
                disabled={actionLoading === "import"}
                onClick={onImport}
            >
                {actionLoading === "import" ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Mengimpor...</>
                ) : (
                    `Import ${rows.length} Baris`
                )}
            </Button>
        </div>
    )
}

function DropZone({
    fileInputRef,
    dragging,
    onFileChange,
    onDragOver,
    onDragLeave,
    onDrop,
}: {
    fileInputRef: React.RefObject<HTMLInputElement | null>
    dragging: boolean
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    onDragOver: (e: React.DragEvent) => void
    onDragLeave: () => void
    onDrop: (e: React.DragEvent) => void
}) {
    return (
        <div
            className={`border border-dashed px-4 py-3 cursor-pointer transition-all duration-150 flex items-center gap-3 ${
                dragging
                    ? "border-orange-400 bg-orange-50/50 dark:bg-orange-950/20"
                    : "border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={onFileChange}
            />
            <div className={`h-9 w-9 flex items-center justify-center border transition-colors shrink-0 ${
                dragging ? "border-orange-300 bg-orange-100" : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
            }`}>
                <UploadCloud className={`h-4 w-4 transition-colors ${dragging ? "text-orange-500" : "text-zinc-400"}`} />
            </div>
            <div>
                <div className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                    Seret file bank statement atau klik untuk upload
                </div>
                <div className="text-[9px] text-zinc-400">Format: CSV, Excel (.xlsx)</div>
            </div>
        </div>
    )
}

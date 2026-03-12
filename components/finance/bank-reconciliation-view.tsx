"use client"

import { useState, useRef, useCallback, useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Landmark,
    Plus,
    Upload,
    Download,
    Wand2,
    Lock,
    FileSpreadsheet,
    X,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    AlertCircle,
    ArrowRightLeft,
    Loader2,
    Unlink,
    Sparkles,
    UploadCloud,
    ArrowRight,
    Search,
    Filter,
    Ban,
    Undo2,
    MessageSquare,
} from "lucide-react"
import { toast } from "sonner"
import { NB } from "@/lib/dialog-styles"
import type {
    ReconciliationSummary,
    ReconciliationDetail,
    SystemEntryData,
    PaginationMeta,
} from "@/lib/actions/finance-reconciliation"
import { createBankAccount } from "@/lib/actions/finance-reconciliation"

// ==============================================================================
// Indonesian Banks
// ==============================================================================

const INDONESIAN_BANKS = [
    "Bank BCA",
    "Bank Mandiri",
    "Bank BNI",
    "Bank BRI",
    "Bank CIMB Niaga",
    "Bank Danamon",
    "Bank Permata",
    "Bank OCBC NISP",
    "Bank Mega",
    "Bank BTN",
    "Bank Panin",
    "Bank Maybank Indonesia",
    "Bank Sinarmas",
    "Bank BTPN",
    "Bank DBS Indonesia",
    "Bank UOB Indonesia",
    "Bank Jago",
    "Bank Digital BCA (Blu)",
    "Bank Syariah Indonesia (BSI)",
    "Bank Muamalat",
    "Jenius (Bank BTPN)",
]

// ==============================================================================
// Types
// ==============================================================================

interface BankAccount {
    id: string
    code: string
    name: string
    balance: number
}

interface BankReconciliationViewProps {
    reconciliations: ReconciliationSummary[]
    bankAccounts: BankAccount[]
    onCreateReconciliation: (data: {
        glAccountId: string
        statementDate: string
        periodStart: string
        periodEnd: string
        bankStatementBalance?: number
        notes?: string
    }) => Promise<{ success: boolean; reconciliationId?: string; error?: string }>
    onImportRows: (
        reconciliationId: string,
        rows: { date: string; description: string; amount: number; reference?: string }[]
    ) => Promise<{ success: boolean; importedCount?: number; error?: string }>
    onAutoMatch: (reconciliationId: string) => Promise<{ success: boolean; matched?: number; matchedCount?: number; suggestions?: unknown[]; error?: string }>
    onMatchItems: (data: { bankItemIds: string[]; systemEntryIds: string[] }) => Promise<{ success: boolean; error?: string }>
    onUnmatchItem: (itemId: string) => Promise<{ success: boolean; error?: string }>
    onClose: (reconciliationId: string) => Promise<{ success: boolean; error?: string }>
    onLoadDetail: (reconciliationId: string, options?: { bankPage?: number; bankPageSize?: number; systemPage?: number; systemPageSize?: number }) => Promise<ReconciliationDetail | null>
    onUpdateMeta: (reconciliationId: string, data: { bankStatementBalance?: number; notes?: string }) => Promise<{ success: boolean; error?: string }>
    onExcludeItem: (itemId: string, reason: string) => Promise<{ success: boolean; error?: string }>
    onIncludeItem: (itemId: string) => Promise<{ success: boolean; error?: string }>
}

// ==============================================================================
// Status helpers
// ==============================================================================

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
    REC_DRAFT: { label: "Draft", bg: "bg-zinc-100", text: "text-zinc-600", border: "border-zinc-300", dot: "bg-zinc-400" },
    REC_IN_PROGRESS: { label: "Dalam Proses", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300", dot: "bg-amber-400" },
    REC_COMPLETED: { label: "Selesai", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300", dot: "bg-emerald-500" },
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

function detectColumns(headers: string[]): {
    dateIdx: number
    descIdx: number
    amountIdx: number
    refIdx: number
} {
    const lower = headers.map((h) => h.toLowerCase().trim())
    const dateIdx = lower.findIndex((h) => /tanggal|date/.test(h))
    const descIdx = lower.findIndex((h) => /deskripsi|description|keterangan/.test(h))
    const amountIdx = lower.findIndex((h) => /jumlah|amount|nominal/.test(h))
    const refIdx = lower.findIndex((h) => /referensi|reference|ref/.test(h))
    return {
        dateIdx: dateIdx >= 0 ? dateIdx : 0,
        descIdx: descIdx >= 0 ? descIdx : 1,
        amountIdx: amountIdx >= 0 ? amountIdx : 2,
        refIdx: refIdx >= 0 ? refIdx : 3,
    }
}

// ==============================================================================
// Skeleton for detail panel
// ==============================================================================

function DetailSkeleton() {
    return (
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-pulse">
            {/* Header skeleton */}
            <div className="flex items-center justify-between px-5 py-3 border-b-2 border-black bg-zinc-50">
                <div className="space-y-1.5">
                    <div className="h-4 w-40 bg-zinc-200 rounded" />
                    <div className="h-3 w-24 bg-zinc-100 rounded" />
                </div>
                <div className="h-4 w-32 bg-zinc-100 rounded" />
            </div>
            {/* KPI strip skeleton */}
            <div className="grid grid-cols-4 border-b-2 border-black">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={`p-4 space-y-2 ${i < 3 ? "border-r border-zinc-200" : ""}`}>
                        <div className="h-2.5 w-16 bg-zinc-100 rounded" />
                        <div className="h-6 w-12 bg-zinc-200 rounded" />
                    </div>
                ))}
            </div>
            {/* Action bar skeleton */}
            <div className="px-5 py-3 border-b border-zinc-200 flex gap-2">
                <div className="h-8 w-28 bg-zinc-100 rounded" />
                <div className="h-8 w-36 bg-zinc-100 rounded" />
            </div>
            {/* Side by side skeleton */}
            <div className="grid grid-cols-2 divide-x divide-zinc-200">
                {[0, 1].map((col) => (
                    <div key={col}>
                        <div className="bg-zinc-50 px-4 py-2.5 border-b border-zinc-200">
                            <div className="h-3 w-28 bg-zinc-200 rounded" />
                        </div>
                        {[0, 1, 2, 3].map((row) => (
                            <div key={row} className="px-4 py-3 border-b border-zinc-100 space-y-1.5">
                                <div className="flex justify-between">
                                    <div className="h-2.5 w-20 bg-zinc-100 rounded" />
                                    <div className="h-3.5 w-24 bg-zinc-200 rounded" />
                                </div>
                                <div className="h-3 w-40 bg-zinc-100 rounded" />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}

// ==============================================================================
// Progress ring SVG
// ==============================================================================

function ProgressRing({ percent, size = 44, stroke = 4 }: { percent: number; size?: number; stroke?: number }) {
    const radius = (size - stroke) / 2
    const circ = 2 * Math.PI * radius
    const offset = circ - (percent / 100) * circ
    const color = percent >= 80 ? "#10b981" : percent >= 40 ? "#f59e0b" : "#ef4444"
    return (
        <svg width={size} height={size} className="shrink-0 -rotate-90">
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e4e4e7" strokeWidth={stroke} />
            <circle
                cx={size / 2} cy={size / 2} r={radius} fill="none"
                stroke={color} strokeWidth={stroke}
                strokeDasharray={circ} strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-500"
            />
            <text
                x={size / 2} y={size / 2}
                textAnchor="middle" dominantBaseline="central"
                className="rotate-90 origin-center fill-zinc-700 dark:fill-zinc-300"
                fontSize="11" fontWeight="800"
            >
                {Math.round(percent)}%
            </text>
        </svg>
    )
}

// ==============================================================================
// Component
// ==============================================================================

export function BankReconciliationView({
    reconciliations,
    bankAccounts,
    onCreateReconciliation,
    onImportRows,
    onAutoMatch,
    onMatchItems,
    onUnmatchItem,
    onClose,
    onLoadDetail,
    onUpdateMeta,
    onExcludeItem,
    onIncludeItem,
}: BankReconciliationViewProps) {
    const queryClient = useQueryClient()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // UI state
    const [loading, setLoading] = useState(false)
    const [detailLoading, setDetailLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [createOpen, setCreateOpen] = useState(false)
    const [addBankOpen, setAddBankOpen] = useState(false)
    const [selectedRec, setSelectedRec] = useState<ReconciliationDetail | null>(null)
    const [selectedRecId, setSelectedRecId] = useState<string | null>(null)
    const [dragging, setDragging] = useState(false)
    const [parsedRows, setParsedRows] = useState<
        { date: string; description: string; amount: number; reference?: string }[] | null
    >(null)

    // Create form state
    const [newAccountId, setNewAccountId] = useState("")
    const [newStatementDate, setNewStatementDate] = useState("")
    const [newPeriodStart, setNewPeriodStart] = useState("")
    const [newPeriodEnd, setNewPeriodEnd] = useState("")
    const [newBankStatementBalance, setNewBankStatementBalance] = useState("")

    // Exclude dialog state
    const [excludeDialogOpen, setExcludeDialogOpen] = useState(false)
    const [excludeItemId, setExcludeItemId] = useState<string | null>(null)
    const [excludeReason, setExcludeReason] = useState("")

    // Detail panel editable meta
    const [editBankStatementBalance, setEditBankStatementBalance] = useState("")
    const [editNotes, setEditNotes] = useState("")

    // Add bank state
    const [newBankCode, setNewBankCode] = useState("")
    const [newBankName, setNewBankName] = useState("")
    const [newBankBalance, setNewBankBalance] = useState("")
    const [newBankDesc, setNewBankDesc] = useState("")
    const [addingBank, setAddingBank] = useState(false)

    // Selection state
    const [selectedBankIds, setSelectedBankIds] = useState<Set<string>>(new Set())
    const [selectedSystemIds, setSelectedSystemIds] = useState<Set<string>>(new Set())

    // Pagination state
    const [bankPage, setBankPage] = useState(1)
    const [systemPage, setSystemPage] = useState(1)
    const PAGE_SIZE = 50

    // Suggestions state (from auto-match)
    const [suggestions, setSuggestions] = useState<{ bankItemId: string; matches: { transactionId: string; confidence: string; score: number; reason: string }[] }[]>([])

    // Search & filter state
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("all")

    // ── Filtered reconciliations ──────────────────────────────────────────────
    const filteredReconciliations = useMemo(() => {
        return (reconciliations || []).filter((rec) => {
            if (statusFilter !== "all" && rec.status !== statusFilter) return false
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase()
                return rec.glAccountName.toLowerCase().includes(q)
            }
            return true
        })
    }, [reconciliations, searchQuery, statusFilter])

    // ── Derived data ──────────────────────────────────────────────────────────
    const unmatchedBankItems = selectedRec?.items.filter((i) => i.matchStatus === "UNMATCHED") ?? []
    const excludedBankItems = selectedRec?.items.filter((i) => i.matchStatus === "EXCLUDED") ?? []
    const matchedBankItems = selectedRec?.items.filter((i) => i.matchStatus === "MATCHED") ?? []
    const unmatchedSystemEntries: SystemEntryData[] =
        selectedRec?.systemEntries.filter((e) => e.alreadyMatchedItemId === null) ?? []

    const selectedBankTotal = unmatchedBankItems
        .filter((i) => selectedBankIds.has(i.id))
        .reduce((s, i) => s + i.bankAmount, 0)
    const selectedSystemTotal = unmatchedSystemEntries
        .filter((e) => selectedSystemIds.has(e.entryId))
        .reduce((s, e) => s + e.amount, 0)

    const hasSelection = selectedBankIds.size > 0 || selectedSystemIds.size > 0
    const totalsMatch =
        selectedBankIds.size > 0 &&
        selectedSystemIds.size > 0 &&
        Math.abs(selectedBankTotal - selectedSystemTotal) < 1

    const isCompleted = selectedRec?.status === "REC_COMPLETED"

    // Amounts from selected bank items — used to highlight matching system entries
    const selectedBankAmounts = useMemo(() => {
        const amounts = new Set<number>()
        unmatchedBankItems
            .filter((i) => selectedBankIds.has(i.id))
            .forEach((i) => amounts.add(Math.abs(i.bankAmount)))
        return amounts
    }, [unmatchedBankItems, selectedBankIds])

    // KPI calculations
    const totalItems = selectedRec ? matchedBankItems.length + unmatchedBankItems.length + excludedBankItems.length : 0
    const reconciledCount = matchedBankItems.length + excludedBankItems.length
    const matchedPercent = totalItems > 0 ? (reconciledCount / totalItems) * 100 : 0
    const difference = selectedRec
        ? unmatchedBankItems.reduce((s, i) => s + i.bankAmount, 0) -
          unmatchedSystemEntries.reduce((s, e) => s + e.amount, 0)
        : 0

    // ── File parsing ──────────────────────────────────────────────────────────
    const parseFile = useCallback(async (file: File) => {
        const ext = file.name.split(".").pop()?.toLowerCase()
        try {
            if (ext === "csv") {
                const text = await file.text()
                const lines = text.trim().split("\n").filter(Boolean)
                if (lines.length < 2) {
                    toast.error("File CSV kosong atau hanya berisi header")
                    return
                }
                const headers = lines[0].split(",")
                const { dateIdx, descIdx, amountIdx, refIdx } = detectColumns(headers)
                const rows = lines.slice(1).map((line) => {
                    const parts = line.split(",").map((p) => p.trim())
                    return {
                        date: parts[dateIdx] || "",
                        description: parts[descIdx] || "",
                        amount: parseFloat(parts[amountIdx] || "0"),
                        reference: parts[refIdx] || undefined,
                    }
                }).filter((r) => r.date && r.amount !== 0)
                setParsedRows(rows)
            } else if (ext === "xlsx" || ext === "xls") {
                const buf = await file.arrayBuffer()
                const wb = XLSX.read(buf, { type: "array" })
                const ws = wb.Sheets[wb.SheetNames[0]]
                const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1 }) as unknown as unknown[][]
                if (json.length < 2) {
                    toast.error("File Excel kosong atau hanya berisi header")
                    return
                }
                const headers = (json[0] as unknown[]).map(String)
                const { dateIdx, descIdx, amountIdx, refIdx } = detectColumns(headers)
                const rows = json.slice(1).map((row) => {
                    const arr = row as unknown[]
                    return {
                        date: String(arr[dateIdx] || ""),
                        description: String(arr[descIdx] || ""),
                        amount: parseFloat(String(arr[amountIdx] || "0")),
                        reference: arr[refIdx] ? String(arr[refIdx]) : undefined,
                    }
                }).filter((r) => r.date && r.amount !== 0)
                setParsedRows(rows)
            } else {
                toast.error("Format file tidak didukung. Gunakan .csv atau .xlsx")
            }
        } catch {
            toast.error("Gagal membaca file")
        }
    }, [])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) parseFile(file)
        e.target.value = ""
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setDragging(true)
    }
    const handleDragLeave = () => setDragging(false)
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) parseFile(file)
    }

    const downloadTemplateCSV = () => {
        const header = "TANGGAL,DESKRIPSI,JUMLAH,REFERENSI"
        const example1 = "2024-01-15,Transfer masuk,5000000,TRF001"
        const example2 = "2024-01-16,Bayar supplier,-2500000,INV-2024-001"
        const example3 = "2024-01-17,Pendapatan jasa,3750000,REF002"
        const csv = [header, example1, example2, example3].join("\n")
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "template-rekonsiliasi-bank.csv"
        a.click()
        URL.revokeObjectURL(url)
    }

    // ── Handlers ──────────────────────────────────────────────────────────────
    const reloadDetail = async (recId: string, opts?: { bPage?: number; sPage?: number }) => {
        const detail = await onLoadDetail(recId, {
            bankPage: opts?.bPage ?? bankPage,
            bankPageSize: PAGE_SIZE,
            systemPage: opts?.sPage ?? systemPage,
            systemPageSize: PAGE_SIZE,
        })
        if (detail) setSelectedRec(detail)
        queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
    }

    const handleCreate = async () => {
        if (!newAccountId || !newStatementDate || !newPeriodStart || !newPeriodEnd) {
            toast.error("Semua field wajib diisi")
            return
        }
        setLoading(true)
        try {
            const result = await onCreateReconciliation({
                glAccountId: newAccountId,
                statementDate: newStatementDate,
                periodStart: newPeriodStart,
                periodEnd: newPeriodEnd,
                bankStatementBalance: Number(newBankStatementBalance) || undefined,
            })
            if (result.success) {
                toast.success("Rekonsiliasi berhasil dibuat")
                setCreateOpen(false)
                setNewAccountId("")
                setNewStatementDate("")
                setNewPeriodStart("")
                setNewPeriodEnd("")
                setNewBankStatementBalance("")
                queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
            } else {
                toast.error(result.error || "Gagal membuat rekonsiliasi")
            }
        } catch {
            toast.error("Gagal membuat rekonsiliasi")
        } finally {
            setLoading(false)
        }
    }

    const handleImportParsed = async () => {
        if (!selectedRec || !parsedRows || parsedRows.length === 0) return
        setActionLoading("import")
        try {
            const result = await onImportRows(selectedRec.id, parsedRows)
            if (result.success) {
                toast.success(`${result.importedCount} baris berhasil diimpor`)
                setParsedRows(null)
                await reloadDetail(selectedRec.id)
            } else {
                toast.error(result.error || "Gagal mengimpor")
            }
        } catch {
            toast.error("Gagal mengimpor data")
        } finally {
            setActionLoading(null)
        }
    }

    const handleAutoMatch = async () => {
        if (!selectedRec) return
        setActionLoading("automatch")
        try {
            const result = await onAutoMatch(selectedRec.id)
            if (result.success) {
                const matchCount = result.matched ?? result.matchedCount ?? 0
                const sugArr = Array.isArray(result.suggestions) ? result.suggestions as typeof suggestions : []
                const sugCount = sugArr.length
                toast.success(`${matchCount} item berhasil dicocokkan otomatis${sugCount > 0 ? `, ${sugCount} saran tersedia` : ''}`)
                setSuggestions(sugArr)
                setSelectedBankIds(new Set())
                setSelectedSystemIds(new Set())
                await reloadDetail(selectedRec.id)
            } else {
                toast.error(result.error || "Gagal auto-match")
            }
        } catch {
            toast.error("Gagal melakukan auto-match")
        } finally {
            setActionLoading(null)
        }
    }

    const handleApplySuggestion = async (bankItemId: string, transactionId: string) => {
        try {
            const result = await onMatchItems({
                bankItemIds: [bankItemId],
                systemEntryIds: [transactionId],
            })
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success("Transaksi berhasil dicocokkan")
                setSuggestions(prev => prev.filter(s => s.bankItemId !== bankItemId))
                if (selectedRec) await reloadDetail(selectedRec.id)
            }
        } catch {
            toast.error("Gagal mencocokkan transaksi")
        }
    }

    const handleMatchSelected = async () => {
        if (selectedBankIds.size === 0 || selectedSystemIds.size === 0) {
            toast.error("Pilih minimal 1 item bank dan 1 jurnal sistem")
            return
        }
        setActionLoading("match")
        try {
            const result = await onMatchItems({
                bankItemIds: Array.from(selectedBankIds),
                systemEntryIds: Array.from(selectedSystemIds),
            })
            if (result.success) {
                toast.success("Item berhasil dicocokkan")
                setSelectedBankIds(new Set())
                setSelectedSystemIds(new Set())
                await reloadDetail(selectedRec!.id)
            } else {
                toast.error(result.error || "Gagal mencocokkan")
            }
        } catch {
            toast.error("Gagal mencocokkan item")
        } finally {
            setActionLoading(null)
        }
    }

    const handleUnmatch = async (itemId: string) => {
        setActionLoading(`unmatch-${itemId}`)
        try {
            const result = await onUnmatchItem(itemId)
            if (result.success) {
                toast.success("Pencocokan dibatalkan")
                await reloadDetail(selectedRec!.id)
            } else {
                toast.error(result.error || "Gagal membatalkan pencocokan")
            }
        } catch {
            toast.error("Gagal membatalkan pencocokan")
        } finally {
            setActionLoading(null)
        }
    }

    const handleClose = async () => {
        if (!selectedRec) return
        const confirmed = window.confirm("Tutup rekonsiliasi ini? Setelah ditutup, tidak bisa diubah lagi.")
        if (!confirmed) return
        setActionLoading("close")
        try {
            const result = await onClose(selectedRec.id)
            if (result.success) {
                toast.success("Rekonsiliasi ditutup")
                setSelectedRec(null)
                setSelectedRecId(null)
                queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
            } else {
                toast.error(result.error || "Gagal menutup")
            }
        } catch {
            toast.error("Gagal menutup rekonsiliasi")
        } finally {
            setActionLoading(null)
        }
    }

    const handleSelectRec = async (rec: ReconciliationSummary) => {
        setSelectedRecId(rec.id)
        setDetailLoading(true)
        setSelectedBankIds(new Set())
        setSelectedSystemIds(new Set())
        setParsedRows(null)
        setSuggestions([])
        setBankPage(1)
        setSystemPage(1)
        try {
            const detail = await onLoadDetail(rec.id, {
                bankPage: 1,
                bankPageSize: PAGE_SIZE,
                systemPage: 1,
                systemPageSize: PAGE_SIZE,
            })
            setSelectedRec(detail)
            if (detail) {
                setEditBankStatementBalance(detail.bankStatementBalance != null ? String(detail.bankStatementBalance) : "")
                setEditNotes(detail.notes ?? "")
            }
        } catch {
            toast.error("Gagal memuat detail rekonsiliasi")
        } finally {
            setDetailLoading(false)
        }
    }

    // ── Toggle helpers ────────────────────────────────────────────────────────
    const toggleBankId = (id: string) => {
        setSelectedBankIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleSystemId = (id: string) => {
        setSelectedSystemIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-9 w-9 bg-purple-100 border-2 border-black rounded-none">
                        <Landmark className="h-4.5 w-4.5 text-purple-700" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-widest">Rekonsiliasi Bank</h2>
                        <p className="text-[10px] text-zinc-400 font-bold">
                            {(reconciliations || []).length} sesi &middot; {(reconciliations || []).filter(r => r.status === "REC_IN_PROGRESS").length} dalam proses
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Tambah Bank Dialog */}
                    <Dialog open={addBankOpen} onOpenChange={setAddBankOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="border-2 border-black text-[10px] font-black uppercase tracking-widest h-9 px-3 rounded-none hover:bg-zinc-50">
                                <Landmark className="h-3.5 w-3.5 mr-1.5" /> Tambah Bank
                            </Button>
                        </DialogTrigger>
                        <DialogContent className={NB.contentNarrow}>
                            <DialogHeader className={NB.header}>
                                <DialogTitle className={NB.title}>
                                    <Landmark className="h-5 w-5" /> Tambah Akun Bank
                                </DialogTitle>
                            </DialogHeader>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className={NB.label}>Kode Akun <span className={NB.labelRequired}>*</span></label>
                                    <Input className={NB.inputMono} placeholder="1100" value={newBankCode} onChange={(e) => setNewBankCode(e.target.value)} />
                                </div>
                                <div>
                                    <label className={NB.label}>Nama Bank <span className={NB.labelRequired}>*</span></label>
                                    <Select value={newBankName} onValueChange={setNewBankName}>
                                        <SelectTrigger className={NB.select}>
                                            <SelectValue placeholder="Pilih bank..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {INDONESIAN_BANKS.map((bank) => (
                                                <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className={NB.label}>Keterangan (opsional)</label>
                                    <Input className={NB.input} placeholder="Operasional..." value={newBankDesc} onChange={(e) => setNewBankDesc(e.target.value)} />
                                </div>
                                <div>
                                    <label className={NB.label}>Saldo Awal (Rp)</label>
                                    <Input className={NB.inputMono} type="number" placeholder="0" value={newBankBalance} onChange={(e) => setNewBankBalance(e.target.value)} />
                                </div>
                                <div className={NB.footer}>
                                    <Button variant="outline" className={NB.cancelBtn} onClick={() => setAddBankOpen(false)}>Batal</Button>
                                    <Button className={NB.submitBtn} disabled={addingBank} onClick={async () => {
                                        if (!newBankCode.trim() || !newBankName.trim()) {
                                            toast.error("Kode dan nama bank wajib diisi")
                                            return
                                        }
                                        setAddingBank(true)
                                        try {
                                            const fullName = newBankDesc.trim()
                                                ? `${newBankName} — ${newBankDesc.trim()}`
                                                : newBankName
                                            const result = await createBankAccount({
                                                code: newBankCode.trim(),
                                                name: fullName,
                                                initialBalance: Number(newBankBalance) || 0,
                                            })
                                            if (result.success) {
                                                toast.success("Akun bank berhasil dibuat")
                                                setAddBankOpen(false)
                                                setNewBankCode("")
                                                setNewBankName("")
                                                setNewBankDesc("")
                                                setNewBankBalance("")
                                                queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
                                            } else {
                                                toast.error(result.error || "Gagal membuat akun bank")
                                            }
                                        } catch {
                                            toast.error("Terjadi kesalahan")
                                        } finally {
                                            setAddingBank(false)
                                        }
                                    }}>
                                        {addingBank ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Menyimpan...</> : "Simpan"}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Rekonsiliasi Baru Dialog */}
                    <Dialog open={createOpen} onOpenChange={(open) => {
                        setCreateOpen(open)
                        if (open) {
                            // Auto-fill dates: current month
                            const now = new Date()
                            const y = now.getFullYear()
                            const m = String(now.getMonth() + 1).padStart(2, "0")
                            const lastDay = new Date(y, now.getMonth() + 1, 0).getDate()
                            if (!newPeriodStart) setNewPeriodStart(`${y}-${m}-01`)
                            if (!newPeriodEnd) setNewPeriodEnd(`${y}-${m}-${String(lastDay).padStart(2, "0")}`)
                            if (!newStatementDate) setNewStatementDate(`${y}-${m}-${String(lastDay).padStart(2, "0")}`)
                        }
                    }}>
                        <DialogTrigger asChild>
                            <Button className={NB.triggerBtn}>
                                <Plus className="h-4 w-4 mr-1" /> Rekonsiliasi Baru
                            </Button>
                        </DialogTrigger>
                        <DialogContent className={NB.contentNarrow}>
                            <DialogHeader className={NB.header}>
                                <DialogTitle className={NB.title}>
                                    <Landmark className="h-5 w-5" /> Rekonsiliasi Baru
                                </DialogTitle>
                                <p className="text-zinc-400 text-[11px] font-bold mt-0.5">Buat sesi rekonsiliasi untuk mencocokkan mutasi bank dengan jurnal</p>
                            </DialogHeader>
                            <div className="p-6 space-y-5">
                                {/* Bank Account */}
                                <div>
                                    <label className={NB.label}>Akun Bank <span className={NB.labelRequired}>*</span></label>
                                    {(bankAccounts || []).length > 0 ? (
                                        <>
                                            <Select value={newAccountId} onValueChange={setNewAccountId}>
                                                <SelectTrigger className={NB.select}>
                                                    <SelectValue placeholder="Pilih akun bank..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {(bankAccounts || []).map((a) => (
                                                        <SelectItem key={a.id} value={a.id}>
                                                            <span className="font-mono text-zinc-500 mr-1.5">{a.code}</span>
                                                            <span className="font-bold">{a.name}</span>
                                                            <span className="ml-2 text-zinc-400 text-[10px]">Saldo: Rp {a.balance.toLocaleString("id-ID")}</span>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {/* Selected account balance preview */}
                                            {newAccountId && (() => {
                                                const acct = (bankAccounts || []).find((a) => a.id === newAccountId)
                                                return acct ? (
                                                    <div className="mt-1.5 flex items-center gap-2 text-[10px]">
                                                        <span className="font-mono text-zinc-400">{acct.code}</span>
                                                        <span className="font-bold text-zinc-600">{acct.name}</span>
                                                        <span className="ml-auto font-mono font-bold text-emerald-600">Rp {acct.balance.toLocaleString("id-ID")}</span>
                                                    </div>
                                                ) : null
                                            })()}
                                        </>
                                    ) : (
                                        <div className="border-2 border-dashed border-zinc-300 bg-zinc-50 p-4 text-center space-y-2">
                                            <Landmark className="h-5 w-5 text-zinc-300 mx-auto" />
                                            <p className="text-[11px] text-zinc-400 font-bold">Belum ada akun bank</p>
                                            <p className="text-[10px] text-zinc-400">Tambahkan akun bank terlebih dahulu sebelum membuat rekonsiliasi</p>
                                            <Button
                                                variant="outline"
                                                className="border-2 border-black text-[10px] font-black uppercase h-7 px-3 rounded-none"
                                                onClick={() => { setCreateOpen(false); setAddBankOpen(true) }}
                                            >
                                                <Plus className="h-3 w-3 mr-1" /> Tambah Akun Bank
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {/* Dates */}
                                <div className="space-y-3">
                                    <div>
                                        <label className={NB.label}>Tanggal Statement <span className={NB.labelRequired}>*</span></label>
                                        <Input className={NB.input} type="date" value={newStatementDate} onChange={(e) => setNewStatementDate(e.target.value)} />
                                        <p className="text-[9px] text-zinc-400 mt-0.5">Tanggal cetak/download mutasi bank</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className={NB.label}>Periode Awal <span className={NB.labelRequired}>*</span></label>
                                            <Input className={NB.input} type="date" value={newPeriodStart} onChange={(e) => setNewPeriodStart(e.target.value)} />
                                        </div>
                                        <div>
                                            <label className={NB.label}>Periode Akhir <span className={NB.labelRequired}>*</span></label>
                                            <Input className={NB.input} type="date" value={newPeriodEnd} onChange={(e) => setNewPeriodEnd(e.target.value)} />
                                        </div>
                                    </div>
                                </div>

                                {/* Balance */}
                                <div>
                                    <label className={NB.label}>Saldo Akhir Bank Statement (Rp)</label>
                                    <Input className={NB.inputMono} type="number" placeholder="0" value={newBankStatementBalance} onChange={(e) => setNewBankStatementBalance(e.target.value)} />
                                    <p className="text-[9px] text-zinc-400 mt-0.5">Saldo terakhir di mutasi bank (untuk pencocokan)</p>
                                </div>

                                <div className={NB.footer}>
                                    <Button variant="outline" className={NB.cancelBtn} onClick={() => setCreateOpen(false)}>Batal</Button>
                                    <Button
                                        className={NB.submitBtn}
                                        disabled={loading || !newAccountId || (bankAccounts || []).length === 0}
                                        onClick={handleCreate}
                                    >
                                        {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Membuat...</> : "Buat Rekonsiliasi"}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Main layout: sidebar + detail */}
            <div className="flex gap-4">
                {/* ── Sidebar: reconciliation list ─────────────────────────────── */}
                <div className="w-80 shrink-0 space-y-2">
                    {/* Search & filter */}
                    {reconciliations.length > 0 && (
                        <div className="space-y-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                                <Input
                                    placeholder="Cari akun..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="h-8 pl-8 text-[11px] font-medium border-2 border-black rounded-none placeholder:text-zinc-300"
                                />
                            </div>
                            <div className="flex gap-1">
                                {[
                                    { key: "all", label: "Semua" },
                                    { key: "REC_DRAFT", label: "Draft" },
                                    { key: "REC_IN_PROGRESS", label: "Proses" },
                                    { key: "REC_COMPLETED", label: "Selesai" },
                                ].map((f) => (
                                    <button
                                        key={f.key}
                                        onClick={() => setStatusFilter(f.key)}
                                        className={`text-[8px] font-black uppercase tracking-wider px-2 py-1 border transition-all ${
                                            statusFilter === f.key
                                                ? "bg-zinc-900 text-white border-black"
                                                : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {reconciliations.length === 0 ? (
                        <div className="bg-white border-2 border-black p-8 text-center space-y-3">
                            <div className="flex items-center justify-center h-12 w-12 mx-auto bg-purple-50 border-2 border-purple-200 rounded-none">
                                <Landmark className="h-6 w-6 text-purple-300" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
                                Belum ada rekonsiliasi
                            </span>
                            <p className="text-[10px] text-zinc-400">Klik &quot;Rekonsiliasi Baru&quot; untuk memulai</p>
                        </div>
                    ) : filteredReconciliations.length === 0 ? (
                        <div className="bg-white border-2 border-black p-6 text-center space-y-2">
                            <Filter className="h-5 w-5 mx-auto text-zinc-300" />
                            <span className="text-[10px] font-bold text-zinc-400 block">
                                Tidak ada hasil untuk filter ini
                            </span>
                            <button
                                onClick={() => { setSearchQuery(""); setStatusFilter("all") }}
                                className="text-[9px] font-black text-purple-600 hover:underline uppercase"
                            >
                                Reset Filter
                            </button>
                        </div>
                    ) : (
                        <ScrollArea className="max-h-[75vh]">
                            <div className="space-y-2 pr-2">
                                {filteredReconciliations.map((rec) => {
                                    const isSelected = selectedRecId === rec.id
                                    const total = rec.matchedCount + rec.unmatchedCount
                                    const pct = total > 0 ? (rec.matchedCount / total) * 100 : 0
                                    const statusCfg = STATUS_CONFIG[rec.status] || STATUS_CONFIG.REC_DRAFT

                                    return (
                                        <button
                                            key={rec.id}
                                            className={`w-full text-left bg-white border-2 border-black p-3.5 transition-all duration-150 group ${
                                                isSelected
                                                    ? "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-purple-50/50"
                                                    : "hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px]"
                                            }`}
                                            onClick={() => handleSelectRec(rec)}
                                        >
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <span className="text-xs font-black truncate">{rec.glAccountName}</span>
                                                <span className={`text-[8px] font-black px-1.5 py-0.5 border shrink-0 ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                                                    {statusCfg.label}
                                                </span>
                                            </div>
                                            <div className="text-[9px] text-zinc-400 font-bold mb-2.5">
                                                {formatDate(rec.periodStart)} — {formatDate(rec.periodEnd)}
                                            </div>
                                            {/* Progress bar */}
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between text-[9px] font-bold">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-emerald-600">{rec.matchedCount} cocok</span>
                                                        <span className="text-red-500">{rec.unmatchedCount} belum</span>
                                                    </div>
                                                    <span className="text-zinc-400 font-mono">{Math.round(pct)}%</span>
                                                </div>
                                                <div className="h-1.5 bg-zinc-100 border border-zinc-200 overflow-hidden">
                                                    <div
                                                        className={`h-full transition-all duration-500 ${
                                                            pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-400" : "bg-red-400"
                                                        }`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                            {/* Loading indicator */}
                                            {detailLoading && isSelected && (
                                                <div className="flex items-center gap-1.5 mt-2 text-[9px] font-bold text-purple-600">
                                                    <Loader2 className="h-3 w-3 animate-spin" /> Memuat detail...
                                                </div>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                {/* ── Detail panel ─────────────────────────────────────────────── */}
                <div className="flex-1 min-w-0">
                    {detailLoading ? (
                        <DetailSkeleton />
                    ) : selectedRec ? (
                        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            {/* Account header with progress ring */}
                            <div className="flex items-center justify-between px-5 py-3 border-b-2 border-black bg-zinc-50">
                                <div className="flex items-center gap-3">
                                    <ProgressRing percent={matchedPercent} />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black">{selectedRec.glAccountName}</span>
                                            <span className="text-[9px] font-mono text-zinc-400 bg-zinc-100 px-1.5 py-0.5 border border-zinc-200">
                                                {selectedRec.glAccountCode}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-zinc-400 font-bold">
                                            Saldo Buku: <span className="font-mono text-zinc-600">Rp {formatIDR(selectedRec.glAccountBalance)}</span>
                                        </span>
                                    </div>
                                </div>
                                {isCompleted && (
                                    <div className="flex items-center gap-1.5 bg-emerald-100 border border-emerald-300 px-2.5 py-1">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                        <span className="text-[9px] font-black text-emerald-700 uppercase tracking-wider">Selesai</span>
                                    </div>
                                )}
                            </div>

                            {/* Editable meta: bank statement balance & notes */}
                            {!isCompleted && (
                                <div className="px-5 py-3 border-b border-zinc-200 bg-white space-y-2">
                                    <div className="flex items-center gap-4">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 shrink-0">
                                            Saldo Bank Statement:
                                        </label>
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs font-bold text-zinc-500">Rp</span>
                                            <Input
                                                type="number"
                                                placeholder="0"
                                                value={editBankStatementBalance}
                                                onChange={(e) => setEditBankStatementBalance(e.target.value)}
                                                onBlur={async () => {
                                                    if (!selectedRec) return
                                                    const val = Number(editBankStatementBalance) || 0
                                                    if (val === (selectedRec.bankStatementBalance ?? 0)) return
                                                    const result = await onUpdateMeta(selectedRec.id, { bankStatementBalance: val })
                                                    if (result.success) {
                                                        toast.success("Saldo bank statement diperbarui")
                                                        await reloadDetail(selectedRec.id)
                                                    } else {
                                                        toast.error(result.error || "Gagal memperbarui")
                                                    }
                                                }}
                                                className="h-7 w-48 border-2 border-black font-mono font-bold text-sm rounded-none placeholder:text-zinc-300 placeholder:font-normal"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 shrink-0 pt-1">
                                            Catatan:
                                        </label>
                                        <textarea
                                            placeholder="Catatan rekonsiliasi..."
                                            value={editNotes}
                                            onChange={(e) => setEditNotes(e.target.value)}
                                            onBlur={async () => {
                                                if (!selectedRec) return
                                                if (editNotes === (selectedRec.notes ?? "")) return
                                                const result = await onUpdateMeta(selectedRec.id, { notes: editNotes })
                                                if (result.success) {
                                                    toast.success("Catatan diperbarui")
                                                    await reloadDetail(selectedRec.id)
                                                } else {
                                                    toast.error(result.error || "Gagal memperbarui")
                                                }
                                            }}
                                            className="flex-1 border-2 border-black font-medium text-xs min-h-[36px] max-h-[60px] rounded-none p-2 resize-none placeholder:text-zinc-300 placeholder:font-normal"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* KPI strip */}
                            <div className="grid grid-cols-4 border-b-2 border-black">
                                {[
                                    { label: "Total Item", value: totalItems, icon: FileSpreadsheet, color: "text-zinc-700", topColor: "bg-zinc-300" },
                                    { label: "Cocok", value: matchedBankItems.length, icon: CheckCircle2, color: "text-emerald-700", topColor: "bg-emerald-400" },
                                    { label: "Belum Cocok", value: unmatchedBankItems.length, icon: AlertCircle, color: unmatchedBankItems.length > 0 ? "text-red-600" : "text-emerald-700", topColor: unmatchedBankItems.length > 0 ? "bg-red-400" : "bg-emerald-400" },
                                    { label: "Dikecualikan", value: excludedBankItems.length, icon: Ban, color: excludedBankItems.length > 0 ? "text-zinc-600" : "text-zinc-400", topColor: excludedBankItems.length > 0 ? "bg-zinc-400" : "bg-zinc-200" },
                                ].map((kpi, i) => (
                                    <div key={kpi.label} className={`relative p-3.5 ${i < 3 ? "border-r border-zinc-200" : ""}`}>
                                        <div className={`absolute top-0 left-0 right-0 h-[3px] ${kpi.topColor}`} />
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <kpi.icon className="h-3 w-3 text-zinc-400" />
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">{kpi.label}</span>
                                        </div>
                                        <span className={`text-lg font-black font-mono ${kpi.color}`}>{kpi.value}</span>
                                    </div>
                                ))}
                            </div>

                            {/* ── Reconciliation Summary Panel (THE ACCOUNTING EQUATION) ── */}
                            {selectedRec.bankStatementBalance != null && (() => {
                                const bookBalance = selectedRec.bookBalanceSnapshot ?? selectedRec.glAccountBalance
                                const outstandingDeposits = unmatchedBankItems.filter(i => i.bankAmount > 0).reduce((s, i) => s + i.bankAmount, 0)
                                const outstandingChecks = unmatchedBankItems.filter(i => i.bankAmount < 0).reduce((s, i) => s + i.bankAmount, 0)
                                const excludedTotal = excludedBankItems.reduce((s, i) => s + i.bankAmount, 0)
                                const adjustedBookBalance = bookBalance + outstandingDeposits + outstandingChecks - excludedTotal
                                const bsBalance = selectedRec.bankStatementBalance ?? 0
                                const diff = adjustedBookBalance - bsBalance
                                return (
                                    <div className="border-b-2 border-black bg-white">
                                        <div className="bg-zinc-900 px-5 py-2 flex items-center gap-2">
                                            <ArrowRightLeft className="h-3.5 w-3.5 text-zinc-400" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-white">
                                                Ringkasan Rekonsiliasi
                                            </span>
                                        </div>
                                        <div className="px-5 py-3 space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold text-zinc-600">Saldo Buku (Book Balance)</span>
                                                <span className="text-[11px] font-mono font-bold text-zinc-800">Rp {formatIDR(bookBalance)}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold text-zinc-500">+ Setoran dalam perjalanan</span>
                                                <span className="text-[11px] font-mono font-bold text-emerald-600">Rp {formatIDR(outstandingDeposits)}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold text-zinc-500">- Cek beredar</span>
                                                <span className="text-[11px] font-mono font-bold text-red-600">Rp {formatIDR(Math.abs(outstandingChecks))}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold text-zinc-500">- Item dikecualikan</span>
                                                <span className="text-[11px] font-mono font-bold text-zinc-500">Rp {formatIDR(Math.abs(excludedTotal))}</span>
                                            </div>
                                            <div className="border-t-2 border-black my-1" />
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-black text-zinc-800">Saldo Buku Disesuaikan</span>
                                                <span className="text-sm font-mono font-black text-zinc-900">Rp {formatIDR(adjustedBookBalance)}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-black text-zinc-800">Saldo Bank Statement</span>
                                                <span className="text-sm font-mono font-black text-zinc-900">Rp {formatIDR(bsBalance)}</span>
                                            </div>
                                            <div className="border-t border-dashed border-zinc-300 my-1" />
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-800">Selisih</span>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-sm font-mono font-black ${Math.abs(diff) < 1 ? "text-emerald-600" : "text-red-600"}`}>
                                                        Rp {formatIDR(Math.abs(diff))}
                                                    </span>
                                                    {Math.abs(diff) < 1 ? (
                                                        <span className="text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-300 px-1.5 py-0.5">
                                                            SEIMBANG
                                                        </span>
                                                    ) : (
                                                        <span className="text-[8px] font-black uppercase tracking-wider bg-red-100 text-red-700 border border-red-300 px-1.5 py-0.5">
                                                            BELUM SEIMBANG
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })()}

                            {/* Action bar */}
                            {!isCompleted && (
                                <div className="px-5 py-2.5 border-b border-zinc-200 flex items-center gap-2 flex-wrap bg-white">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-[9px] font-black uppercase border-2 border-black rounded-none gap-1.5 hover:bg-purple-50"
                                        disabled={actionLoading !== null}
                                        onClick={handleAutoMatch}
                                    >
                                        {actionLoading === "automatch" ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <Wand2 className="h-3 w-3" />
                                        )}
                                        {actionLoading === "automatch" ? "Mencocokkan..." : "Auto-Match"}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-[9px] font-black uppercase border-2 border-black rounded-none gap-1.5 hover:bg-red-50 text-red-600 border-red-300"
                                        disabled={actionLoading !== null || unmatchedBankItems.length > 0}
                                        onClick={handleClose}
                                    >
                                        {actionLoading === "close" ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <Lock className="h-3 w-3" />
                                        )}
                                        Tutup Rekonsiliasi
                                    </Button>
                                    <div className="flex-1" />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 text-[9px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 hover:bg-blue-50 gap-1 px-2"
                                        onClick={downloadTemplateCSV}
                                    >
                                        <Download className="h-3 w-3" /> Template CSV
                                    </Button>
                                </div>
                            )}

                            {/* File upload zone */}
                            {!isCompleted && (
                                <div className="px-5 py-3 border-b border-zinc-200 bg-white">
                                    {parsedRows ? (
                                        /* Preview of parsed rows */
                                        <div className="border-2 border-emerald-400 bg-emerald-50 p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center justify-center h-7 w-7 bg-emerald-100 border border-emerald-300">
                                                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                                        {parsedRows.length} baris siap diimpor
                                                    </span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 hover:bg-emerald-100"
                                                    onClick={() => setParsedRows(null)}
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                            <div className="max-h-24 overflow-y-auto text-[9px] font-mono text-zinc-600 space-y-0.5 mb-3 bg-white p-2 border border-emerald-200">
                                                {parsedRows.slice(0, 5).map((r, i) => (
                                                    <div key={i} className="flex justify-between gap-2">
                                                        <span className="text-zinc-400 shrink-0">{r.date}</span>
                                                        <span className="truncate flex-1">{r.description}</span>
                                                        <span className={`shrink-0 font-bold ${r.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                                            Rp {formatIDR(Math.abs(r.amount))}
                                                        </span>
                                                    </div>
                                                ))}
                                                {parsedRows.length > 5 && (
                                                    <div className="text-zinc-400 text-center">...dan {parsedRows.length - 5} baris lainnya</div>
                                                )}
                                            </div>
                                            <Button
                                                className={NB.submitBtn + " w-full"}
                                                disabled={actionLoading === "import"}
                                                onClick={handleImportParsed}
                                            >
                                                {actionLoading === "import" ? (
                                                    <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Mengimpor...</>
                                                ) : (
                                                    `Import ${parsedRows.length} Baris`
                                                )}
                                            </Button>
                                        </div>
                                    ) : (
                                        /* Drop zone */
                                        <div
                                            className={`border-2 border-dashed p-5 text-center cursor-pointer transition-all duration-150 ${
                                                dragging
                                                    ? "border-purple-500 bg-purple-50 scale-[1.01]"
                                                    : "border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50"
                                            }`}
                                            onClick={() => fileInputRef.current?.click()}
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                        >
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".csv,.xlsx,.xls"
                                                className="hidden"
                                                onChange={handleFileChange}
                                            />
                                            <UploadCloud className={`h-6 w-6 mx-auto mb-1.5 transition-colors ${dragging ? "text-purple-500" : "text-zinc-300"}`} />
                                            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                                Seret file bank statement atau klik untuk upload
                                            </div>
                                            <div className="text-[9px] text-zinc-400 mt-0.5">Format: CSV, Excel (.xlsx)</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Auto-match suggestions */}
                            {suggestions.length > 0 && (
                                <div className="border-b-2 border-black bg-amber-50/50 p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="h-4 w-4 text-amber-500" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                                                Saran Pencocokan ({suggestions.length})
                                            </span>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setSuggestions([])}
                                            className="h-6 px-2 text-[9px] font-bold rounded-none border border-amber-300 text-amber-700 hover:bg-amber-100"
                                        >
                                            Tutup
                                        </Button>
                                    </div>
                                    {suggestions.map((s) => (
                                        <div key={s.bankItemId} className="border-2 border-amber-200 bg-white p-3 space-y-2">
                                            <div className="text-[10px] font-bold text-zinc-500">
                                                Bank Item: <span className="font-mono">{s.bankItemId.slice(0, 8)}...</span>
                                            </div>
                                            {s.matches.map((m) => (
                                                <div key={m.transactionId} className="flex items-center justify-between gap-2 bg-zinc-50 p-2 border border-zinc-200">
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        <span className={`inline-block px-1.5 py-0.5 text-[8px] font-black border ${
                                                            m.confidence === "HIGH" ? "bg-emerald-100 text-emerald-800 border-emerald-400" :
                                                            m.confidence === "MEDIUM" ? "bg-amber-100 text-amber-800 border-amber-400" :
                                                            "bg-zinc-100 text-zinc-600 border-zinc-300"
                                                        }`}>
                                                            {m.confidence}
                                                        </span>
                                                        <span className="text-[10px] text-zinc-600 truncate">{m.reason}</span>
                                                        <span className="text-[10px] font-mono font-bold text-zinc-400 shrink-0">
                                                            skor {m.score}
                                                        </span>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleApplySuggestion(s.bankItemId, m.transactionId)}
                                                        className="h-6 px-3 text-[9px] font-black rounded-none border-2 border-black bg-black text-white hover:bg-zinc-800 shrink-0"
                                                    >
                                                        Terapkan
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Side-by-side panels */}
                            <ScrollArea className="max-h-[50vh]">
                                <div className="grid grid-cols-2 divide-x-2 divide-black">
                                    {/* Left: LAPORAN BANK */}
                                    <div>
                                        <div className="bg-blue-50 px-4 py-2.5 border-b-2 border-black flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-blue-500" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-700">
                                                Laporan Bank ({selectedRec?.bankPagination?.totalItems ?? unmatchedBankItems.length})
                                            </span>
                                        </div>
                                        {unmatchedBankItems.length === 0 && excludedBankItems.length === 0 ? (
                                            <div className="p-8 text-center">
                                                <CheckCircle2 className="h-6 w-6 mx-auto text-emerald-300 mb-2" />
                                                <span className="text-[10px] font-bold text-zinc-400">
                                                    Semua item sudah dicocokkan
                                                </span>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Unmatched bank items */}
                                                <div className="divide-y divide-zinc-100">
                                                    {unmatchedBankItems.map((item) => {
                                                        const isSelected = selectedBankIds.has(item.id)
                                                        return (
                                                            <div
                                                                key={item.id}
                                                                className={`flex items-start gap-2.5 px-4 py-2.5 cursor-pointer transition-all duration-100 ${
                                                                    isSelected ? "bg-blue-50 border-l-[3px] border-l-blue-500" : "hover:bg-zinc-50 border-l-[3px] border-l-transparent"
                                                                }`}
                                                                onClick={() => !isCompleted && toggleBankId(item.id)}
                                                            >
                                                                {!isCompleted && (
                                                                    <Checkbox
                                                                        checked={isSelected}
                                                                        onCheckedChange={() => toggleBankId(item.id)}
                                                                        className="mt-0.5 border-2 border-black rounded-none"
                                                                    />
                                                                )}
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center justify-between gap-1">
                                                                        <span className="text-[9px] font-mono text-zinc-400">
                                                                            {item.bankDate ? formatDate(item.bankDate) : "-"}
                                                                        </span>
                                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                                            <span
                                                                                className={`text-xs font-mono font-bold ${
                                                                                    item.bankAmount >= 0 ? "text-emerald-600" : "text-red-600"
                                                                                }`}
                                                                            >
                                                                                Rp {formatIDR(Math.abs(item.bankAmount))}
                                                                            </span>
                                                                            {!isCompleted && (
                                                                                <button
                                                                                    title="Kecualikan item"
                                                                                    className="h-5 w-5 flex items-center justify-center border border-zinc-300 rounded-none text-zinc-400 hover:text-red-500 hover:border-red-300 hover:bg-red-50 transition-colors"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation()
                                                                                        setExcludeItemId(item.id)
                                                                                        setExcludeReason("")
                                                                                        setExcludeDialogOpen(true)
                                                                                    }}
                                                                                >
                                                                                    <Ban className="h-3 w-3" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-xs font-medium truncate mt-0.5">
                                                                        {item.bankDescription || "-"}
                                                                    </div>
                                                                    {item.bankRef && (
                                                                        <div className="text-[9px] text-zinc-400 font-mono truncate">
                                                                            Ref: {item.bankRef}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>

                                                {/* Excluded bank items section */}
                                                {excludedBankItems.length > 0 && (
                                                    <div className="bg-zinc-100/70">
                                                        <div className="px-4 py-2 border-t border-zinc-200 border-b border-b-zinc-200 flex items-center gap-2">
                                                            <Ban className="h-3 w-3 text-zinc-400" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                                                                Dikecualikan ({excludedBankItems.length})
                                                            </span>
                                                        </div>
                                                        <div className="divide-y divide-zinc-200">
                                                            {excludedBankItems.map((item) => (
                                                                <div
                                                                    key={item.id}
                                                                    className="flex items-start gap-2.5 px-4 py-2 border-l-[3px] border-l-zinc-300 opacity-60"
                                                                >
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center justify-between gap-1">
                                                                            <span className="text-[9px] font-mono text-zinc-400">
                                                                                {item.bankDate ? formatDate(item.bankDate) : "-"}
                                                                            </span>
                                                                            <span className="text-xs font-mono font-bold text-zinc-400 line-through shrink-0">
                                                                                Rp {formatIDR(Math.abs(item.bankAmount))}
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-xs font-medium truncate mt-0.5 text-zinc-500">
                                                                            {item.bankDescription || "-"}
                                                                        </div>
                                                                        {item.excludeReason && (
                                                                            <div className="flex items-center gap-1 mt-0.5">
                                                                                <MessageSquare className="h-2.5 w-2.5 text-zinc-400 shrink-0" />
                                                                                <span className="text-[9px] text-zinc-400 italic truncate">
                                                                                    {item.excludeReason}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {!isCompleted && (
                                                                        <button
                                                                            title="Kembalikan item"
                                                                            className="h-6 flex items-center gap-1 px-1.5 border border-zinc-300 rounded-none text-[9px] font-bold text-zinc-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-colors shrink-0"
                                                                            onClick={async () => {
                                                                                const result = await onIncludeItem(item.id)
                                                                                if (result.success) {
                                                                                    toast.success("Item dikembalikan")
                                                                                    if (selectedRec) await reloadDetail(selectedRec.id)
                                                                                } else {
                                                                                    toast.error(result.error || "Gagal mengembalikan item")
                                                                                }
                                                                            }}
                                                                        >
                                                                            <Undo2 className="h-3 w-3" /> Undo
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {/* Pagination: Bank Items */}
                                        {selectedRec?.bankPagination && selectedRec.bankPagination.totalPages > 1 && (
                                            <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-200 bg-zinc-50">
                                                <span className="text-[9px] font-bold text-zinc-400">
                                                    Hal {selectedRec.bankPagination.page}/{selectedRec.bankPagination.totalPages}
                                                    {" "}({selectedRec.bankPagination.totalItems} item)
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-6 w-6 p-0 border border-black rounded-none"
                                                        disabled={bankPage <= 1 || detailLoading}
                                                        onClick={async () => {
                                                            const newPage = bankPage - 1
                                                            setBankPage(newPage)
                                                            if (selectedRec) await reloadDetail(selectedRec.id, { bPage: newPage })
                                                        }}
                                                    >
                                                        <ChevronLeft className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-6 w-6 p-0 border border-black rounded-none"
                                                        disabled={bankPage >= (selectedRec.bankPagination.totalPages) || detailLoading}
                                                        onClick={async () => {
                                                            const newPage = bankPage + 1
                                                            setBankPage(newPage)
                                                            if (selectedRec) await reloadDetail(selectedRec.id, { bPage: newPage })
                                                        }}
                                                    >
                                                        <ChevronRight className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right: JURNAL SISTEM */}
                                    <div>
                                        <div className="bg-purple-50 px-4 py-2.5 border-b-2 border-black flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-purple-500" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-purple-700">
                                                Jurnal Sistem ({selectedRec?.systemPagination?.totalItems ?? unmatchedSystemEntries.length})
                                            </span>
                                        </div>
                                        {unmatchedSystemEntries.length === 0 ? (
                                            <div className="p-8 text-center">
                                                <CheckCircle2 className="h-6 w-6 mx-auto text-emerald-300 mb-2" />
                                                <span className="text-[10px] font-bold text-zinc-400">
                                                    Semua jurnal sudah dicocokkan
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-zinc-100">
                                                {unmatchedSystemEntries.map((entry) => {
                                                    const isSelected = selectedSystemIds.has(entry.entryId)
                                                    // Highlight if amount matches a selected bank item
                                                    const isAmountMatch = selectedBankAmounts.size > 0 && selectedBankAmounts.has(Math.abs(entry.amount))
                                                    return (
                                                        <div
                                                            key={entry.entryId}
                                                            className={`flex items-start gap-2.5 px-4 py-2.5 cursor-pointer transition-all duration-100 ${
                                                                isSelected
                                                                    ? "bg-purple-50 border-l-[3px] border-l-purple-500"
                                                                    : isAmountMatch && !isCompleted
                                                                        ? "bg-amber-50/50 border-l-[3px] border-l-amber-400 ring-1 ring-inset ring-amber-200"
                                                                        : "hover:bg-zinc-50 border-l-[3px] border-l-transparent"
                                                            }`}
                                                            onClick={() => !isCompleted && toggleSystemId(entry.entryId)}
                                                        >
                                                            {!isCompleted && (
                                                                <Checkbox
                                                                    checked={isSelected}
                                                                    onCheckedChange={() => toggleSystemId(entry.entryId)}
                                                                    className="mt-0.5 border-2 border-black rounded-none"
                                                                />
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center justify-between gap-1">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-[9px] font-mono text-zinc-400">
                                                                            {formatDate(entry.date)}
                                                                        </span>
                                                                        {isAmountMatch && !isSelected && !isCompleted && (
                                                                            <span className="text-[8px] font-black text-amber-600 bg-amber-100 px-1 py-0.5 border border-amber-300">
                                                                                COCOK
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <span
                                                                        className={`text-xs font-mono font-bold shrink-0 ${
                                                                            entry.amount >= 0 ? "text-emerald-600" : "text-red-600"
                                                                        }`}
                                                                    >
                                                                        Rp {formatIDR(Math.abs(entry.amount))}
                                                                    </span>
                                                                </div>
                                                                <div className="text-xs font-medium truncate mt-0.5">
                                                                    {entry.lineDescription || entry.description || "-"}
                                                                </div>
                                                                {entry.reference && (
                                                                    <div className="text-[9px] text-zinc-400 font-mono truncate">
                                                                        Ref: {entry.reference}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                        {/* Pagination: System Entries */}
                                        {selectedRec?.systemPagination && selectedRec.systemPagination.totalPages > 1 && (
                                            <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-200 bg-zinc-50">
                                                <span className="text-[9px] font-bold text-zinc-400">
                                                    Hal {selectedRec.systemPagination.page}/{selectedRec.systemPagination.totalPages}
                                                    {" "}({selectedRec.systemPagination.totalItems} jurnal)
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-6 w-6 p-0 border border-black rounded-none"
                                                        disabled={systemPage <= 1 || detailLoading}
                                                        onClick={async () => {
                                                            const newPage = systemPage - 1
                                                            setSystemPage(newPage)
                                                            if (selectedRec) await reloadDetail(selectedRec.id, { sPage: newPage })
                                                        }}
                                                    >
                                                        <ChevronLeft className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-6 w-6 p-0 border border-black rounded-none"
                                                        disabled={systemPage >= (selectedRec.systemPagination.totalPages) || detailLoading}
                                                        onClick={async () => {
                                                            const newPage = systemPage + 1
                                                            setSystemPage(newPage)
                                                            if (selectedRec) await reloadDetail(selectedRec.id, { sPage: newPage })
                                                        }}
                                                    >
                                                        <ChevronRight className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </ScrollArea>

                            {/* Match action bar — sticky at bottom */}
                            {hasSelection && !isCompleted && (
                                <div className="px-5 py-3 border-t-2 border-black bg-zinc-900 flex items-center justify-between gap-3 flex-wrap">
                                    <div className="flex items-center gap-4 text-[10px] font-bold text-white">
                                        <span>
                                            <span className="text-blue-300">Bank:</span>{" "}
                                            <span className="font-mono text-white">
                                                Rp {formatIDR(Math.abs(selectedBankTotal))}
                                            </span>
                                            <span className="text-zinc-500 ml-1">({selectedBankIds.size} item)</span>
                                        </span>
                                        <ArrowRightLeft className="h-3.5 w-3.5 text-zinc-500" />
                                        <span>
                                            <span className="text-purple-300">Sistem:</span>{" "}
                                            <span className="font-mono text-white">
                                                Rp {formatIDR(Math.abs(selectedSystemTotal))}
                                            </span>
                                            <span className="text-zinc-500 ml-1">({selectedSystemIds.size} jurnal)</span>
                                        </span>
                                        {selectedBankIds.size > 0 && selectedSystemIds.size > 0 && (
                                            totalsMatch ? (
                                                <span className="flex items-center gap-1 text-emerald-400">
                                                    <CheckCircle2 className="h-3.5 w-3.5" /> Total cocok
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-amber-400">
                                                    <AlertCircle className="h-3.5 w-3.5" /> Selisih Rp {formatIDR(Math.abs(selectedBankTotal - selectedSystemTotal))}
                                                </span>
                                            )
                                        )}
                                    </div>
                                    <Button
                                        className="bg-white text-black border-2 border-white shadow-[3px_3px_0px_0px_rgba(255,255,255,0.3)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(255,255,255,0.3)] transition-all font-black uppercase text-[10px] tracking-wider px-6 h-8 rounded-none disabled:opacity-40"
                                        disabled={actionLoading !== null || selectedBankIds.size === 0 || selectedSystemIds.size === 0}
                                        onClick={handleMatchSelected}
                                    >
                                        {actionLoading === "match" ? (
                                            <><Loader2 className="h-3 w-3 animate-spin mr-1.5" /> Mencocokkan...</>
                                        ) : (
                                            <>Cocokkan Terpilih <ArrowRight className="h-3 w-3 ml-1" /></>
                                        )}
                                    </Button>
                                </div>
                            )}

                            {/* Matched pairs section */}
                            {matchedBankItems.length > 0 && (
                                <div className="border-t-2 border-black">
                                    <div className="bg-emerald-50 px-5 py-2.5 border-b border-emerald-200 flex items-center gap-2">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                            Sudah Dicocokkan ({matchedBankItems.length} pasang)
                                        </span>
                                    </div>
                                    <div className="divide-y divide-emerald-100 bg-emerald-50/30">
                                        {matchedBankItems.map((item) => {
                                            const matchedEntry = selectedRec?.systemEntries.find(
                                                (e) => e.alreadyMatchedItemId === item.id
                                            )
                                            return (
                                                <div
                                                    key={item.id}
                                                    className="flex items-center justify-between px-5 py-2.5 gap-3"
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                                                            <span className="text-xs font-medium truncate">
                                                                {item.bankDescription || "-"}
                                                            </span>
                                                            <span
                                                                className={`text-xs font-mono font-bold shrink-0 ${
                                                                    item.bankAmount >= 0 ? "text-emerald-600" : "text-red-600"
                                                                }`}
                                                            >
                                                                Rp {formatIDR(Math.abs(item.bankAmount))}
                                                            </span>
                                                        </div>
                                                        {matchedEntry && (
                                                            <div className="text-[9px] text-zinc-500 truncate ml-5">
                                                                Jurnal: {matchedEntry.lineDescription || matchedEntry.description}
                                                                {matchedEntry.reference ? ` (${matchedEntry.reference})` : ""}
                                                            </div>
                                                        )}
                                                        {!matchedEntry && item.systemDescription && (
                                                            <div className="text-[9px] text-zinc-500 truncate ml-5">
                                                                Jurnal: {item.systemDescription}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {!isCompleted && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-6 text-[9px] font-black uppercase border border-red-300 text-red-500 rounded-none px-2 shrink-0 hover:bg-red-50 gap-1"
                                                            disabled={actionLoading === `unmatch-${item.id}`}
                                                            onClick={() => handleUnmatch(item.id)}
                                                        >
                                                            {actionLoading === `unmatch-${item.id}` ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : (
                                                                <Unlink className="h-3 w-3" />
                                                            )}
                                                            Batalkan
                                                        </Button>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Empty state — onboarding card */
                        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-10">
                            <div className="max-w-md mx-auto text-center">
                                <div className="flex items-center justify-center h-16 w-16 mx-auto bg-purple-50 border-2 border-purple-200 mb-5">
                                    <Landmark className="h-8 w-8 text-purple-400" />
                                </div>
                                <h3 className="text-sm font-black uppercase tracking-widest mb-2">Pilih Rekonsiliasi</h3>
                                <p className="text-[11px] text-zinc-400 font-medium mb-6">
                                    Pilih sesi di sebelah kiri, atau buat rekonsiliasi baru untuk memulai
                                </p>
                                {/* 3-step workflow guide */}
                                <div className="flex items-center justify-center gap-3 text-left">
                                    {[
                                        { step: "1", icon: Upload, label: "Upload", desc: "Impor mutasi bank" },
                                        { step: "2", icon: ArrowRightLeft, label: "Cocokkan", desc: "Auto/manual match" },
                                        { step: "3", icon: Lock, label: "Tutup", desc: "Finalisasi rekon" },
                                    ].map((s, i) => (
                                        <div key={s.step} className="flex items-center gap-3">
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center justify-center h-8 w-8 bg-zinc-900 text-white text-[10px] font-black border-2 border-black">
                                                    {s.step}
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-black uppercase">{s.label}</div>
                                                    <div className="text-[9px] text-zinc-400">{s.desc}</div>
                                                </div>
                                            </div>
                                            {i < 2 && <ArrowRight className="h-3.5 w-3.5 text-zinc-300 shrink-0" />}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Exclude Item Dialog ─────────────────────────────────────────── */}
            <Dialog open={excludeDialogOpen} onOpenChange={setExcludeDialogOpen}>
                <DialogContent className={NB.contentNarrow}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}>
                            <Ban className="h-5 w-5" /> Kecualikan Item
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className={NB.label}>Alasan <span className={NB.labelRequired}>*</span></label>
                            <Input
                                className={NB.input}
                                placeholder="biaya admin, bunga bank, dll"
                                value={excludeReason}
                                onChange={(e) => setExcludeReason(e.target.value)}
                                onKeyDown={async (e) => {
                                    if (e.key === "Enter" && excludeReason.trim() && excludeItemId) {
                                        const result = await onExcludeItem(excludeItemId, excludeReason.trim())
                                        if (result.success) {
                                            toast.success("Item dikecualikan")
                                            setExcludeDialogOpen(false)
                                            if (selectedRec) await reloadDetail(selectedRec.id)
                                        } else {
                                            toast.error(result.error || "Gagal mengecualikan item")
                                        }
                                    }
                                }}
                            />
                        </div>
                        <div className={NB.footer}>
                            <Button variant="outline" className={NB.cancelBtn} onClick={() => setExcludeDialogOpen(false)}>
                                Batal
                            </Button>
                            <Button
                                className={NB.submitBtn}
                                disabled={!excludeReason.trim()}
                                onClick={async () => {
                                    if (!excludeItemId || !excludeReason.trim()) return
                                    const result = await onExcludeItem(excludeItemId, excludeReason.trim())
                                    if (result.success) {
                                        toast.success("Item dikecualikan")
                                        setExcludeDialogOpen(false)
                                        if (selectedRec) await reloadDetail(selectedRec.id)
                                    } else {
                                        toast.error(result.error || "Gagal mengecualikan item")
                                    }
                                }}
                            >
                                Kecualikan
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

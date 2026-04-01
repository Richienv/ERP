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
import { motion } from "framer-motion"
import { toast } from "sonner"
import { NB } from "@/lib/dialog-styles"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBDialogFooter,
    NBSection,
    NBInput,
    NBCurrencyInput,
} from "@/components/ui/nb-dialog"
import type {
    ReconciliationSummary,
    ReconciliationDetail,
    SystemEntryData,
} from "@/lib/actions/finance-reconciliation"
import { Switch } from "@/components/ui/switch"
import { createBankAccount } from "@/lib/actions/finance-reconciliation"
import type { BankAccountRecord, COAAccount } from "@/hooks/use-reconciliation"

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
    bankAccountRecords?: BankAccountRecord[]
    coaAccounts?: COAAccount[]
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
// Progress ring SVG
// ==============================================================================

function ProgressRing({ percent, size = 44, stroke = 4 }: { percent: number; size?: number; stroke?: number }) {
    const radius = (size - stroke) / 2
    const circ = 2 * Math.PI * radius
    const offset = circ - (percent / 100) * circ
    const color = percent >= 80 ? "#10b981" : percent >= 40 ? "#f59e0b" : "#ef4444"
    const trackColor = percent >= 80 ? "#d1fae5" : percent >= 40 ? "#fef3c7" : "#fee2e2"
    const fontSize = size >= 52 ? 13 : 11
    return (
        <svg width={size} height={size} className="shrink-0 -rotate-90">
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={stroke} />
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
                fontSize={fontSize} fontWeight="800"
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
    bankAccountRecords = [],
    coaAccounts = [],
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

    // Add bank state (expanded form)
    const [newBankCode, setNewBankCode] = useState("")
    const [newBankName, setNewBankName] = useState("")
    const [newBankBalance, setNewBankBalance] = useState("")
    const [newBankDesc, setNewBankDesc] = useState("")
    const [newBankAccountNumber, setNewBankAccountNumber] = useState("")
    const [newBankAccountHolder, setNewBankAccountHolder] = useState("")
    const [newBankBranch, setNewBankBranch] = useState("")
    const [newBankCurrency, setNewBankCurrency] = useState("IDR")
    const [newBankCoaId, setNewBankCoaId] = useState("")
    const [newBankIsActive, setNewBankIsActive] = useState(true)
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

    // ── File parsing ──────────────────────────────────────────────────────────
    const parseFile = useCallback(async (file: File) => {
        const ext = file.name.split(".").pop()?.toLowerCase()
        try {
            if (ext === "csv") {
                const text = await file.text()
                // Strip BOM and skip comment lines (starting with #)
                const cleaned = text.replace(/^\uFEFF/, "")
                const lines = cleaned.trim().split("\n").filter(l => l.trim() && !l.trim().startsWith("#"))
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
        const instructions = [
            "# Format tanggal: dd/mm/yyyy",
            "# Jumlah positif = uang masuk, negatif = uang keluar",
        ]
        const header = "Tanggal,Referensi,Deskripsi,Jumlah"
        const example1 = "31/03/2026,TRF-001,Pembayaran dari PT ABC,5000000"
        const example2 = "31/03/2026,TRF-002,Transfer ke supplier,-3000000"
        const example3 = "01/04/2026,TRF-003,Penerimaan piutang,10000000"
        const csv = [...instructions, header, example1, example2, example3].join("\n")
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
            const totalIn = parsedRows.filter(r => r.amount > 0).reduce((s, r) => s + r.amount, 0)
            const totalOut = Math.abs(parsedRows.filter(r => r.amount < 0).reduce((s, r) => s + r.amount, 0))
            const result = await onImportRows(selectedRec.id, parsedRows)
            if (result.success) {
                toast.success(`${result.importedCount} baris diimpor — Masuk: Rp ${formatIDR(totalIn)}, Keluar: Rp ${formatIDR(totalOut)}`)
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
                if (selectedRec) await reloadDetail(selectedRec.id)
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
                if (selectedRec) await reloadDetail(selectedRec.id)
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
        // Check balance difference before closing
        if (selectedRec.bankStatementBalance != null) {
            const bookBalance = selectedRec.bookBalanceSnapshot ?? selectedRec.glAccountBalance
            const outDeposits = unmatchedBankItems.filter(i => i.bankAmount > 0).reduce((s, i) => s + i.bankAmount, 0)
            const outChecks = unmatchedBankItems.filter(i => i.bankAmount < 0).reduce((s, i) => s + i.bankAmount, 0)
            const excludedTtl = excludedBankItems.reduce((s, i) => s + i.bankAmount, 0)
            const adjustedBook = bookBalance + outDeposits + outChecks - excludedTtl
            const diff = Math.abs(adjustedBook - (selectedRec.bankStatementBalance ?? 0))
            if (diff >= 1) {
                toast.error(`Selisih Rp ${formatIDR(diff)} — saldo buku dan bank belum seimbang. Selesaikan selisih sebelum menutup rekonsiliasi.`)
                return
            }
        }
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
                queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.accountTransactions.all })
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

    // ── KPI counts ─────────────────────────────────────────────────────────
    const recList = reconciliations || []
    const kpiAll = recList.length
    const kpiDraft = recList.filter(r => r.status === "REC_DRAFT").length
    const kpiInProgress = recList.filter(r => r.status === "REC_IN_PROGRESS").length
    const kpiCompleted = recList.filter(r => r.status === "REC_COMPLETED").length

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4">
            {/* ─── Unified Page Header ─── */}
            <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring" as const, stiffness: 320, damping: 26 }}
                className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900"
            >
                {/* Orange accent bar */}
                <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />

                {/* Row 1: Title + Actions */}
                <div className="px-5 py-3.5 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-orange-500 flex items-center justify-center">
                            <Landmark className="h-4.5 w-4.5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                                Rekonsiliasi Bank
                            </h1>
                            <p className="text-zinc-400 text-[11px] font-medium">
                                Cocokkan mutasi bank dengan jurnal sistem
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-0">
                    {/* Tambah Bank Dialog — Expanded Form */}
                    <Dialog open={addBankOpen} onOpenChange={setAddBankOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className={NB.toolbarBtn + " " + NB.toolbarBtnJoin}>
                                <Landmark className="h-3.5 w-3.5 mr-1.5" /> Tambah Bank
                            </Button>
                        </DialogTrigger>
                        <DialogContent className={NB.content}>
                            <DialogHeader className={NB.header}>
                                <DialogTitle className={NB.title}>
                                    <Landmark className="h-5 w-5" /> Tambah Akun Bank
                                </DialogTitle>
                                <p className="text-zinc-400 text-[11px] font-bold mt-0.5">Daftarkan akun bank baru untuk rekonsiliasi</p>
                            </DialogHeader>
                            <ScrollArea className="max-h-[70vh]">
                            <div className="p-6 space-y-5">
                                {/* ── Section: Informasi Bank ─── */}
                                <div>
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-1.5">
                                        <Landmark className="h-3 w-3" /> Informasi Bank
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <label className={NB.label}>Kode <span className={NB.labelRequired}>*</span></label>
                                                <Input className={NB.inputMono} placeholder="1100" value={newBankCode} onChange={(e) => setNewBankCode(e.target.value)} />
                                            </div>
                                            <div className="col-span-2">
                                                <label className={NB.label}>Nama Bank <span className={NB.labelRequired}>*</span></label>
                                                <Select value={newBankName} onValueChange={setNewBankName}>
                                                    <SelectTrigger className={NB.select}>
                                                        <SelectValue placeholder="Pilih bank..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {INDONESIAN_BANKS.map((bank) => (
                                                            <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                                                        ))}
                                                        <SelectItem value="__lainnya__">Lainnya...</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        {newBankName === "__lainnya__" && (
                                            <div>
                                                <label className={NB.label}>Nama Bank (custom) <span className={NB.labelRequired}>*</span></label>
                                                <Input className={NB.input} placeholder="Nama bank..." onChange={(e) => {
                                                    // Store custom name temporarily — we'll use it on submit
                                                    setNewBankDesc(prev => {
                                                        const marker = "__CUSTOM_BANK:"
                                                        const cleaned = prev.replace(new RegExp(`${marker}[^|]*\\|?`), "")
                                                        return `${marker}${e.target.value}|${cleaned}`
                                                    })
                                                }} />
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className={NB.label}>Nomor Rekening <span className={NB.labelRequired}>*</span></label>
                                                <Input
                                                    className={`${NB.inputMono} ${newBankAccountNumber ? NB.inputActive : NB.inputEmpty}`}
                                                    placeholder="1234567890"
                                                    value={newBankAccountNumber}
                                                    onChange={(e) => setNewBankAccountNumber(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className={NB.label}>Nama Pemilik Rekening <span className={NB.labelRequired}>*</span></label>
                                                <Input
                                                    className={`${NB.input} ${newBankAccountHolder ? NB.inputActive : NB.inputEmpty}`}
                                                    placeholder="PT Nama Perusahaan"
                                                    value={newBankAccountHolder}
                                                    onChange={(e) => setNewBankAccountHolder(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className={NB.label}>Cabang</label>
                                            <Input
                                                className={`${NB.input} ${newBankBranch ? NB.inputActive : NB.inputEmpty}`}
                                                placeholder="KCP Jakarta Selatan"
                                                value={newBankBranch}
                                                onChange={(e) => setNewBankBranch(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ── Section: Pengaturan ─── */}
                                <div>
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-1.5">
                                        <ArrowRightLeft className="h-3 w-3" /> Pengaturan
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className={NB.label}>Mata Uang</label>
                                                <Select value={newBankCurrency} onValueChange={setNewBankCurrency}>
                                                    <SelectTrigger className={NB.select}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="IDR">IDR — Rupiah</SelectItem>
                                                        <SelectItem value="USD">USD — US Dollar</SelectItem>
                                                        <SelectItem value="EUR">EUR — Euro</SelectItem>
                                                        <SelectItem value="SGD">SGD — Singapore Dollar</SelectItem>
                                                        <SelectItem value="JPY">JPY — Japanese Yen</SelectItem>
                                                        <SelectItem value="CNY">CNY — Chinese Yuan</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <label className={NB.label}>Akun COA</label>
                                                <Select value={newBankCoaId} onValueChange={setNewBankCoaId}>
                                                    <SelectTrigger className={NB.select}>
                                                        <SelectValue placeholder="Auto / Pilih..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__auto__">Buat otomatis</SelectItem>
                                                        {coaAccounts.map((coa) => (
                                                            <SelectItem key={coa.id} value={coa.id}>
                                                                {coa.code} — {coa.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <p className="text-[9px] text-zinc-400 mt-0.5">Link ke Chart of Accounts (ASSET)</p>
                                            </div>
                                        </div>
                                        <div>
                                            <label className={NB.label}>Saldo Awal</label>
                                            <div className="relative">
                                                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold pointer-events-none transition-colors ${
                                                    newBankBalance ? "text-orange-500" : "text-zinc-400"
                                                }`}>Rp</span>
                                                <input
                                                    inputMode="numeric"
                                                    placeholder="0"
                                                    value={newBankBalance ? Number(newBankBalance).toLocaleString("id-ID") : ""}
                                                    onChange={(e) => {
                                                        const raw = e.target.value.replace(/[^\d]/g, "")
                                                        setNewBankBalance(raw)
                                                    }}
                                                    onKeyDown={(e) => {
                                                        const allowed = ["Backspace", "Delete", "Tab", "Escape", "Enter", "ArrowLeft", "ArrowRight", "Home", "End"]
                                                        if (allowed.includes(e.key)) return
                                                        if ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x"].includes(e.key.toLowerCase())) return
                                                        if (!/^\d$/.test(e.key)) e.preventDefault()
                                                    }}
                                                    className={`w-full pl-10 pr-3 h-10 font-mono font-bold text-sm rounded-none outline-none transition-colors ${
                                                        newBankBalance
                                                            ? "border-2 border-orange-400 bg-orange-50/50 text-zinc-900"
                                                            : "border-2 border-zinc-300 bg-zinc-50/50 text-zinc-900"
                                                    } placeholder:text-zinc-300 placeholder:font-normal focus:border-orange-400 focus:ring-2 focus:ring-orange-100`}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className={NB.label}>Keterangan</label>
                                            <Input
                                                className={`${NB.input} ${newBankDesc && !newBankDesc.startsWith("__CUSTOM_BANK:") ? NB.inputActive : NB.inputEmpty}`}
                                                placeholder="Rekening operasional..."
                                                value={newBankDesc.startsWith("__CUSTOM_BANK:") ? "" : newBankDesc}
                                                onChange={(e) => setNewBankDesc(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ── Section: Status ─── */}
                                <div>
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">
                                        Status
                                    </h3>
                                    <div className="flex items-center justify-between border-2 border-zinc-200 px-4 py-3">
                                        <div>
                                            <span className="text-sm font-bold text-zinc-700">Status Aktif</span>
                                            <p className="text-[10px] text-zinc-400">Akun bank aktif dapat digunakan untuk rekonsiliasi</p>
                                        </div>
                                        <Switch checked={newBankIsActive} onCheckedChange={setNewBankIsActive} />
                                    </div>
                                </div>

                                {/* Preview */}
                                {(newBankCode.trim() || newBankName) && (
                                    <div className="border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 space-y-1">
                                        <div className="flex items-center gap-3">
                                            <Landmark className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                            <span className="font-mono font-bold text-[11px] text-zinc-500">{newBankCode || "—"}</span>
                                            <span className="text-sm font-bold text-zinc-700 truncate">
                                                {newBankName === "__lainnya__" ? "(Custom)" : newBankName}
                                            </span>
                                        </div>
                                        {newBankAccountNumber && (
                                            <p className="text-[11px] text-zinc-500 pl-8">
                                                Rek: <span className="font-mono font-bold">{newBankAccountNumber}</span>
                                                {newBankAccountHolder && <> a.n. <span className="font-bold">{newBankAccountHolder}</span></>}
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div className={NB.footer}>
                                    <Button variant="outline" className={NB.cancelBtn} onClick={() => setAddBankOpen(false)}>Batal</Button>
                                    <Button className={NB.submitBtn} disabled={addingBank} onClick={async () => {
                                        // Resolve custom bank name
                                        let resolvedBankName = newBankName
                                        if (newBankName === "__lainnya__") {
                                            const match = newBankDesc.match(/__CUSTOM_BANK:([^|]*)/)
                                            resolvedBankName = match?.[1]?.trim() || ""
                                        }
                                        if (!newBankCode.trim() || !resolvedBankName) {
                                            toast.error("Kode dan nama bank wajib diisi")
                                            return
                                        }
                                        if (!newBankAccountNumber.trim()) {
                                            toast.error("Nomor rekening wajib diisi")
                                            return
                                        }
                                        if (!newBankAccountHolder.trim()) {
                                            toast.error("Nama pemilik rekening wajib diisi")
                                            return
                                        }
                                        setAddingBank(true)
                                        try {
                                            // Clean description (remove custom bank marker)
                                            let cleanDesc = newBankDesc
                                            if (cleanDesc.startsWith("__CUSTOM_BANK:")) {
                                                cleanDesc = cleanDesc.replace(/__CUSTOM_BANK:[^|]*\|?/, "").trim()
                                            }
                                            const result = await createBankAccount({
                                                code: newBankCode.trim(),
                                                bankName: resolvedBankName,
                                                accountNumber: newBankAccountNumber.trim(),
                                                accountHolder: newBankAccountHolder.trim(),
                                                branch: newBankBranch.trim() || undefined,
                                                currency: newBankCurrency,
                                                coaAccountId: newBankCoaId && newBankCoaId !== "__auto__" ? newBankCoaId : undefined,
                                                openingBalance: Number(newBankBalance) || 0,
                                                description: cleanDesc || undefined,
                                                isActive: newBankIsActive,
                                            })
                                            if (result.success) {
                                                toast.success("Akun bank berhasil dibuat")
                                                setAddBankOpen(false)
                                                setNewBankCode("")
                                                setNewBankName("")
                                                setNewBankDesc("")
                                                setNewBankBalance("")
                                                setNewBankAccountNumber("")
                                                setNewBankAccountHolder("")
                                                setNewBankBranch("")
                                                setNewBankCurrency("IDR")
                                                setNewBankCoaId("")
                                                setNewBankIsActive(true)
                                                queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
                                                queryClient.invalidateQueries({ queryKey: queryKeys.glAccounts.all })
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
                            </ScrollArea>
                        </DialogContent>
                    </Dialog>

                    {/* Rekonsiliasi Baru Trigger + Dialog */}
                    <Button className={NB.toolbarBtnPrimary} onClick={() => {
                        const now = new Date()
                        const y = now.getFullYear()
                        const m = String(now.getMonth() + 1).padStart(2, "0")
                        const d = String(now.getDate()).padStart(2, "0")
                        // Auto-suggest: start of month → today
                        if (!newPeriodStart) setNewPeriodStart(`${y}-${m}-01`)
                        if (!newPeriodEnd) setNewPeriodEnd(`${y}-${m}-${d}`)
                        if (!newStatementDate) setNewStatementDate(`${y}-${m}-${d}`)
                        // Auto-select if only 1 bank account
                        if ((bankAccounts || []).length === 1 && !newAccountId) {
                            setNewAccountId(bankAccounts[0].id)
                        }
                        setCreateOpen(true)
                    }}>
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Rekonsiliasi Baru
                    </Button>
                    <NBDialog open={createOpen} onOpenChange={setCreateOpen} size="default">
                        <NBDialogHeader
                            icon={Landmark}
                            title="Rekonsiliasi Baru"
                            subtitle="Cocokkan mutasi bank dengan jurnal sistem"
                        />

                        <NBDialogBody>
                            {/* ── Section 1: Bank Account ─── */}
                            <NBSection icon={Landmark} title="Akun Bank">
                                {(bankAccounts || []).length > 0 ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        {(bankAccounts || []).map((a) => (
                                            <button
                                                key={a.id}
                                                type="button"
                                                onClick={() => setNewAccountId(a.id)}
                                                className={`flex items-center gap-3 px-3.5 py-3 border text-left transition-all ${
                                                    newAccountId === a.id
                                                        ? "border-orange-400 bg-orange-50/50 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]"
                                                        : "border-zinc-200 bg-white hover:border-zinc-400"
                                                }`}
                                            >
                                                <Landmark className={`h-4 w-4 shrink-0 ${newAccountId === a.id ? "text-orange-500" : "text-zinc-400"}`} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-mono text-[11px] text-zinc-500 font-bold">{a.code}</span>
                                                        <span className="text-sm font-bold truncate">{a.name}</span>
                                                    </div>
                                                </div>
                                                <span className="font-mono text-[11px] font-bold text-emerald-600 shrink-0">
                                                    Rp {a.balance.toLocaleString("id-ID")}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="border border-dashed border-zinc-300 bg-zinc-50 p-5 text-center space-y-2">
                                        <Landmark className="h-5 w-5 text-zinc-300 mx-auto" />
                                        <p className="text-[11px] text-zinc-400 font-bold">Belum ada akun bank</p>
                                        <Button
                                            variant="outline"
                                            className="border-2 border-black text-[10px] font-black uppercase h-7 px-3 rounded-none"
                                            onClick={() => { setCreateOpen(false); setAddBankOpen(true) }}
                                        >
                                            <Plus className="h-3 w-3 mr-1" /> Tambah Akun Bank
                                        </Button>
                                    </div>
                                )}
                            </NBSection>

                            {/* ── Section 2: Period ─── */}
                            <NBSection icon={ArrowRightLeft} title="Periode Rekonsiliasi">
                                <div className="grid grid-cols-3 gap-3">
                                    <NBInput
                                        label="Dari"
                                        required
                                        type="date"
                                        value={newPeriodStart}
                                        onChange={setNewPeriodStart}
                                    />
                                    <NBInput
                                        label="Sampai"
                                        required
                                        type="date"
                                        value={newPeriodEnd}
                                        onChange={setNewPeriodEnd}
                                    />
                                    <div>
                                        <NBInput
                                            label="Tanggal Statement"
                                            type="date"
                                            value={newStatementDate}
                                            onChange={setNewStatementDate}
                                        />
                                        <p className="text-[9px] text-zinc-400 mt-0.5">Tanggal cetak mutasi bank</p>
                                    </div>
                                </div>
                            </NBSection>

                            {/* ── Section 3: Balance ─── */}
                            <NBSection icon={Landmark} title="Saldo Bank" optional>
                                {/* Show book balance for reference when bank is selected */}
                                {newAccountId && (() => {
                                    const selectedBank = (bankAccounts || []).find(a => a.id === newAccountId)
                                    return selectedBank ? (
                                        <p className="text-[11px] font-bold text-zinc-500">
                                            Saldo buku: <span className="font-mono text-emerald-600">Rp {selectedBank.balance.toLocaleString("id-ID")}</span>
                                            <span className="text-zinc-400 font-medium ml-1">(referensi)</span>
                                        </p>
                                    ) : null
                                })()}
                                <NBCurrencyInput
                                    label="Saldo Statement"
                                    value={newBankStatementBalance}
                                    onChange={setNewBankStatementBalance}
                                />
                                <p className="text-[9px] text-zinc-400 -mt-1">Ketik angka saja — format otomatis</p>
                            </NBSection>
                        </NBDialogBody>

                        {/* ── Footer ─── */}
                        <NBDialogFooter
                            onCancel={() => setCreateOpen(false)}
                            onSubmit={handleCreate}
                            submitting={loading}
                            submitLabel="Buat Rekonsiliasi"
                            disabled={!newAccountId || (bankAccounts || []).length === 0}
                        />
                    </NBDialog>
                    </div>
                </div>

                {/* Row 2: KPI Strip */}
                <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 divide-x divide-zinc-200 dark:divide-zinc-800">
                    {[
                        { label: "Semua", count: kpiAll, color: "orange", dot: "bg-orange-500" },
                        { label: "Draft", count: kpiDraft, color: "zinc", dot: "bg-zinc-400" },
                        { label: "Dalam Proses", count: kpiInProgress, color: "amber", dot: "bg-amber-500" },
                        { label: "Selesai", count: kpiCompleted, color: "emerald", dot: "bg-emerald-500" },
                    ].map((kpi) => (
                        <div
                            key={kpi.label}
                            className="flex-1 px-4 py-3 flex items-center justify-between gap-3 cursor-default"
                        >
                            <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 ${kpi.dot}`} />
                                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{kpi.label}</span>
                            </div>
                            <motion.span
                                key={kpi.count}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring" as const, stiffness: 400, damping: 20 }}
                                className={`text-xl font-black ${
                                    kpi.color === "amber" && kpi.count > 0
                                        ? "text-amber-600 dark:text-amber-400"
                                        : "text-zinc-900 dark:text-white"
                                }`}
                            >
                                {kpi.count}
                            </motion.span>
                        </div>
                    ))}
                </div>

                {/* Row 3: Filter Toolbar */}
                <div className="px-5 py-2.5 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-800/30">
                    <div className="flex items-center gap-0">
                        {/* Search input with active indicator */}
                        <div className="relative">
                            <Search
                                className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 z-10 transition-colors ${
                                    searchQuery ? "text-orange-500" : "text-zinc-500 dark:text-zinc-400"
                                }`}
                            />
                            <input
                                className={`border border-r-0 font-medium h-9 w-[220px] text-xs rounded-none pl-9 pr-8 outline-none placeholder:text-zinc-400 transition-all ${
                                    searchQuery
                                        ? "border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 text-zinc-900 dark:text-white"
                                        : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                }`}
                                placeholder="Cari akun bank..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-colors z-10"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                        {/* Status filter buttons — joined strip */}
                        {[
                            { key: "all", label: "Semua" },
                            { key: "REC_DRAFT", label: "Draft" },
                            { key: "REC_IN_PROGRESS", label: "Proses" },
                            { key: "REC_COMPLETED", label: "Selesai" },
                        ].map((f, idx, arr) => (
                            <button
                                key={f.key}
                                onClick={() => setStatusFilter(f.key)}
                                className={`h-9 px-3 text-[10px] font-black uppercase tracking-widest transition-all border ${idx < arr.length - 1 ? "border-r-0" : ""} rounded-none ${
                                    statusFilter === f.key
                                        ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                                        : "bg-white dark:bg-zinc-900 text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-300"
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <span className="hidden md:inline text-[11px] font-medium text-zinc-400">
                        <span className="font-mono font-bold text-zinc-600 dark:text-zinc-300">{filteredReconciliations.length}</span> sesi
                    </span>
                </div>
            </motion.div>

            {/* Main layout: sidebar + detail — single unified card */}
            <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring" as const, stiffness: 320, damping: 26, delay: 0.08 }}
                className="border border-zinc-200 dark:border-zinc-700 shadow-sm bg-white dark:bg-zinc-900 overflow-hidden flex rounded-none"
                style={{ minHeight: 520 }}
            >
                {/* ── Sidebar: reconciliation list ─────────────────────────────── */}
                <div className="w-80 shrink-0 border-r border-zinc-200 dark:border-zinc-700 flex flex-col bg-zinc-50/50 dark:bg-zinc-900/50">
                    {/* Sidebar header */}
                    <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                            Sesi Rekonsiliasi
                        </span>
                        <span className="text-[10px] font-mono font-bold text-zinc-400">
                            {filteredReconciliations.length}
                        </span>
                    </div>

                    {reconciliations.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                                <Landmark className="h-5 w-5 text-zinc-300 dark:text-zinc-600" />
                            </div>
                            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 block mb-1">
                                Belum ada rekonsiliasi
                            </span>
                            <p className="text-[10px] text-zinc-400">Klik &quot;Rekonsiliasi Baru&quot; untuk memulai</p>
                        </div>
                    ) : filteredReconciliations.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                            <Filter className="h-5 w-5 mx-auto text-zinc-300 dark:text-zinc-600 mb-3" />
                            <span className="text-[10px] font-bold text-zinc-400 block mb-2">
                                Tidak ada hasil untuk filter ini
                            </span>
                            <button
                                onClick={() => { setSearchQuery(""); setStatusFilter("all") }}
                                className="text-[9px] font-black text-orange-600 hover:underline uppercase"
                            >
                                Reset Filter
                            </button>
                        </div>
                    ) : (
                        <ScrollArea className="flex-1">
                            <div className="p-2 space-y-1">
                                {filteredReconciliations.map((rec) => {
                                    const isSelected = selectedRecId === rec.id
                                    const total = rec.itemCount
                                    const belum = rec.itemCount - rec.matchedCount
                                    const pct = total > 0 ? (rec.matchedCount / total) * 100 : 0
                                    const statusCfg = STATUS_CONFIG[rec.status] || STATUS_CONFIG.REC_DRAFT
                                    const progressColor = pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-400" : "bg-red-400"

                                    return (
                                        <button
                                            key={rec.id}
                                            className={`w-full text-left rounded-none px-3.5 py-3 transition-all duration-150 group relative ${
                                                isSelected
                                                    ? "bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 shadow-sm"
                                                    : "bg-transparent border border-transparent hover:bg-white dark:hover:bg-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700"
                                            }`}
                                            onClick={() => handleSelectRec(rec)}
                                        >
                                            {/* Selected indicator — left accent bar */}
                                            {isSelected && (
                                                <div className="absolute left-0 top-2 bottom-2 w-[3px] bg-orange-500 rounded-r" />
                                            )}
                                            {/* Row 1: Account name + status */}
                                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Landmark className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-orange-500" : "text-zinc-400 dark:text-zinc-500"}`} />
                                                    <span className={`text-xs font-bold truncate ${isSelected ? "text-zinc-900 dark:text-white" : "text-zinc-700 dark:text-zinc-300"}`}>
                                                        {rec.glAccountName}
                                                    </span>
                                                </div>
                                                <span className={`text-[7px] font-black px-1.5 py-0.5 border shrink-0 uppercase tracking-wider ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                                                    {statusCfg.label}
                                                </span>
                                            </div>
                                            {/* Row 2: Period */}
                                            <div className="text-[9px] text-zinc-400 font-medium ml-[22px] mb-2">
                                                {formatDate(rec.periodStart)} — {formatDate(rec.periodEnd)}
                                            </div>
                                            {/* Row 3: Progress bar + stats */}
                                            <div className="ml-[22px]">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="flex-1 h-1.5 bg-zinc-200/70 dark:bg-zinc-700 overflow-hidden rounded-full">
                                                        <div
                                                            className={`h-full transition-all duration-500 rounded-full ${progressColor}`}
                                                            style={{ width: `${Math.max(pct, 2)}%` }}
                                                        />
                                                    </div>
                                                    <span className={`text-[9px] font-mono font-bold shrink-0 ${
                                                        pct >= 80 ? "text-emerald-600" : pct >= 40 ? "text-amber-600" : "text-zinc-400"
                                                    }`}>
                                                        {Math.round(pct)}%
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-[9px] font-medium">
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                        <span className="text-zinc-500 dark:text-zinc-400">{rec.matchedCount} cocok</span>
                                                    </span>
                                                    {belum > 0 && (
                                                        <span className="flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                                            <span className="text-zinc-500 dark:text-zinc-400">{belum} belum</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Loading indicator */}
                                            {detailLoading && isSelected && (
                                                <div className="flex items-center gap-1.5 mt-2 ml-[22px] text-[9px] font-bold text-orange-600">
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
                <div className="flex-1 min-w-0 flex flex-col">
                    {detailLoading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center space-y-3">
                                <Loader2 className="h-8 w-8 animate-spin text-orange-400 mx-auto" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
                                    Memuat detail rekonsiliasi...
                                </span>
                            </div>
                        </div>
                    ) : selectedRec ? (
                        <div className="flex-1 flex flex-col">
                            {/* Account header with progress ring */}
                            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <ProgressRing percent={matchedPercent} size={52} stroke={5} />
                                        <div>
                                            <div className="flex items-center gap-2.5 mb-0.5">
                                                <h2 className="text-base font-black tracking-tight text-zinc-900 dark:text-white">
                                                    {selectedRec.glAccountName}
                                                </h2>
                                                <span className="text-[9px] font-mono font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 border border-zinc-200 dark:border-zinc-700">
                                                    {selectedRec.glAccountCode}
                                                </span>
                                                {(() => {
                                                    const statusCfg = STATUS_CONFIG[selectedRec.status] || STATUS_CONFIG.REC_DRAFT
                                                    return (
                                                        <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                                                            {statusCfg.label}
                                                        </span>
                                                    )
                                                })()}
                                            </div>
                                            <div className="flex items-center gap-4 text-[11px]">
                                                <span className="text-zinc-400 font-medium">
                                                    Saldo Buku: <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">Rp {formatIDR(selectedRec.glAccountBalance)}</span>
                                                </span>
                                                <span className="text-zinc-300 dark:text-zinc-600">|</span>
                                                <span className="text-zinc-400 font-medium">
                                                    Periode: <span className="font-bold text-zinc-600 dark:text-zinc-300">{formatDate(selectedRec.periodStart)} — {formatDate(selectedRec.periodEnd)}</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Editable meta: bank statement balance & notes */}
                            {!isCompleted && (
                                <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
                                    <div className="grid grid-cols-2 gap-5">
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 block">
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
                                                        // Strip non-digit chars, keep only numbers
                                                        const raw = e.target.value.replace(/[^\d]/g, "")
                                                        setEditBankStatementBalance(raw)
                                                    }}
                                                    onKeyDown={(e) => {
                                                        // Allow: backspace, delete, tab, escape, enter, arrows
                                                        const allowed = ["Backspace", "Delete", "Tab", "Escape", "Enter", "ArrowLeft", "ArrowRight", "Home", "End"]
                                                        if (allowed.includes(e.key)) return
                                                        // Allow Ctrl/Cmd+A, Ctrl/Cmd+C, Ctrl/Cmd+V, Ctrl/Cmd+X
                                                        if ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x"].includes(e.key.toLowerCase())) return
                                                        // Block non-digit
                                                        if (!/^\d$/.test(e.key)) {
                                                            e.preventDefault()
                                                        }
                                                    }}
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
                                                    className={`w-full pl-10 pr-3 h-10 font-mono font-bold text-sm rounded-none outline-none transition-colors ${
                                                        editBankStatementBalance
                                                            ? "border-2 border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 text-zinc-900 dark:text-white"
                                                            : "border-2 border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                                                    } placeholder:text-zinc-300 dark:placeholder:text-zinc-600 placeholder:font-normal focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900/30`}
                                                />
                                            </div>
                                            <p className="text-[9px] text-zinc-400 mt-1">Ketik angka saja, format otomatis</p>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 block">
                                                Catatan
                                            </label>
                                            <textarea
                                                placeholder="Catatan rekonsiliasi (opsional)..."
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
                                                className={`w-full font-medium text-xs min-h-[40px] max-h-[60px] rounded-none p-2.5 resize-none transition-colors ${
                                                    editNotes
                                                        ? "border-2 border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20"
                                                        : "border-2 border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                                                } placeholder:text-zinc-300 dark:placeholder:text-zinc-600 placeholder:font-normal`}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* KPI strip */}
                            <div className="flex items-center divide-x divide-zinc-200 dark:divide-zinc-800 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                                {[
                                    { label: "Total Item", value: totalItems, dotColor: "bg-zinc-400", valueColor: "text-zinc-900 dark:text-white" },
                                    { label: "Cocok", value: matchedBankItems.length, dotColor: "bg-emerald-500", valueColor: matchedBankItems.length > 0 ? "text-emerald-600" : "text-zinc-900 dark:text-white" },
                                    { label: "Belum Cocok", value: unmatchedBankItems.length, dotColor: unmatchedBankItems.length > 0 ? "bg-red-500" : "bg-emerald-500", valueColor: unmatchedBankItems.length > 0 ? "text-red-600" : "text-emerald-600" },
                                    { label: "Dikecualikan", value: excludedBankItems.length, dotColor: excludedBankItems.length > 0 ? "bg-zinc-500" : "bg-zinc-300", valueColor: "text-zinc-600 dark:text-zinc-400" },
                                ].map((kpi) => (
                                    <div key={kpi.label} className="flex-1 px-4 py-3 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-2 h-2 rounded-full ${kpi.dotColor}`} />
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{kpi.label}</span>
                                        </div>
                                        <span className={`text-xl font-black font-mono ${kpi.valueColor}`}>{kpi.value}</span>
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
                                const isBalanced = Math.abs(diff) < 1
                                return (
                                    <div className="border-b border-zinc-200 dark:border-zinc-800">
                                        <div className="bg-zinc-50/80 dark:bg-zinc-800/30 px-5 py-2 flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-700">
                                            <ArrowRightLeft className="h-3.5 w-3.5 text-zinc-400" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                                                Ringkasan Rekonsiliasi
                                            </span>
                                        </div>
                                        <div className="bg-white dark:bg-zinc-900">
                                            {/* Balance comparison — 2 column */}
                                            <div className="grid grid-cols-2 divide-x divide-zinc-200 dark:divide-zinc-700 border-b border-zinc-100 dark:border-zinc-800">
                                                <div className="px-5 py-3">
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block mb-0.5">Saldo Buku Disesuaikan</span>
                                                    <span className="text-lg font-mono font-black text-zinc-900 dark:text-white">Rp {formatIDR(adjustedBookBalance)}</span>
                                                </div>
                                                <div className="px-5 py-3">
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block mb-0.5">Saldo Bank Statement</span>
                                                    <span className="text-lg font-mono font-black text-zinc-900 dark:text-white">Rp {formatIDR(bsBalance)}</span>
                                                </div>
                                            </div>
                                            {/* Adjustment details — compact rows */}
                                            <div className="px-5 py-2.5 space-y-1 border-b border-zinc-100 dark:border-zinc-800">
                                                <div className="flex items-center justify-between text-[10px]">
                                                    <span className="font-medium text-zinc-500">Saldo Buku (Book Balance)</span>
                                                    <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">Rp {formatIDR(bookBalance)}</span>
                                                </div>
                                                {outstandingDeposits > 0 && (
                                                    <div className="flex items-center justify-between text-[10px]">
                                                        <span className="font-medium text-zinc-500">+ Setoran dalam perjalanan</span>
                                                        <span className="font-mono font-bold text-emerald-600">+Rp {formatIDR(outstandingDeposits)}</span>
                                                    </div>
                                                )}
                                                {outstandingChecks !== 0 && (
                                                    <div className="flex items-center justify-between text-[10px]">
                                                        <span className="font-medium text-zinc-500">- Cek beredar</span>
                                                        <span className="font-mono font-bold text-red-600">-Rp {formatIDR(Math.abs(outstandingChecks))}</span>
                                                    </div>
                                                )}
                                                {excludedTotal !== 0 && (
                                                    <div className="flex items-center justify-between text-[10px]">
                                                        <span className="font-medium text-zinc-500">- Item dikecualikan</span>
                                                        <span className="font-mono font-bold text-zinc-500">-Rp {formatIDR(Math.abs(excludedTotal))}</span>
                                                    </div>
                                                )}
                                            </div>
                                            {/* Difference result */}
                                            <div className={`px-5 py-2.5 flex items-center justify-between ${
                                                isBalanced ? "bg-emerald-50/50 dark:bg-emerald-950/10" : "bg-red-50/50 dark:bg-red-950/10"
                                            }`}>
                                                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Selisih</span>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-sm font-mono font-black ${isBalanced ? "text-emerald-600" : "text-red-600"}`}>
                                                        Rp {formatIDR(Math.abs(diff))}
                                                    </span>
                                                    {isBalanced ? (
                                                        <span className="text-[8px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 px-1.5 py-0.5 flex items-center gap-1">
                                                            <CheckCircle2 className="h-2.5 w-2.5" /> SEIMBANG
                                                        </span>
                                                    ) : (
                                                        <span className="text-[8px] font-black uppercase tracking-wider bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-700 px-1.5 py-0.5 flex items-center gap-1">
                                                            <AlertCircle className="h-2.5 w-2.5" /> BELUM SEIMBANG
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
                                <div className="px-5 py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-800/30">
                                    <div className="flex items-center gap-0">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className={NB.toolbarBtn + " " + NB.toolbarBtnJoin}
                                            disabled={actionLoading !== null}
                                            onClick={handleAutoMatch}
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
                                        disabled={actionLoading !== null || unmatchedBankItems.length > 0}
                                        onClick={handleClose}
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
                            {!isCompleted && (
                                <div className="px-5 py-3 border-b border-zinc-200 bg-white">
                                    {parsedRows ? (
                                        /* Preview of parsed rows with summary */
                                        <div className="border-2 border-emerald-400 bg-emerald-50 p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center justify-center h-7 w-7 bg-emerald-100 border border-emerald-300">
                                                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 block">
                                                            {parsedRows.length} baris siap diimpor
                                                        </span>
                                                        <div className="flex items-center gap-3 mt-0.5">
                                                            <span className="text-[9px] font-bold text-emerald-600">
                                                                Masuk: Rp {formatIDR(parsedRows.filter(r => r.amount > 0).reduce((s, r) => s + r.amount, 0))}
                                                            </span>
                                                            <span className="text-[9px] font-bold text-red-600">
                                                                Keluar: Rp {formatIDR(Math.abs(parsedRows.filter(r => r.amount < 0).reduce((s, r) => s + r.amount, 0)))}
                                                            </span>
                                                        </div>
                                                    </div>
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
                                        /* Drop zone — compact */
                                        <div
                                            className={`border border-dashed px-4 py-3 cursor-pointer transition-all duration-150 flex items-center gap-3 ${
                                                dragging
                                                    ? "border-orange-400 bg-orange-50/50"
                                                    : "border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
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
                                <div className="grid grid-cols-2 divide-x divide-zinc-200 dark:divide-zinc-700">
                                    {/* Left: LAPORAN BANK */}
                                    <div>
                                        <div className="bg-sky-50/80 dark:bg-sky-950/20 px-4 py-2.5 border-b border-sky-200 dark:border-sky-800 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="h-2 w-2 rounded-full bg-sky-500" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-sky-700 dark:text-sky-400">
                                                    Laporan Bank
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-mono font-bold text-sky-500 dark:text-sky-400">
                                                {selectedRec?.bankPagination?.totalItems ?? unmatchedBankItems.length} item
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
                                        <div className="bg-violet-50/80 dark:bg-violet-950/20 px-4 py-2.5 border-b border-violet-200 dark:border-violet-800 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="h-2 w-2 rounded-full bg-violet-500" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-violet-700 dark:text-violet-400">
                                                    Jurnal Sistem
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-mono font-bold text-violet-500 dark:text-violet-400">
                                                {selectedRec?.systemPagination?.totalItems ?? unmatchedSystemEntries.length} jurnal
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
                                <div className="border-t border-zinc-200 dark:border-zinc-700">
                                    <div className="bg-emerald-50/80 dark:bg-emerald-950/20 px-5 py-2.5 border-b border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                                                Sudah Dicocokkan
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-mono font-bold text-emerald-500 dark:text-emerald-400">
                                            {matchedBankItems.length} pasang
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
            </motion.div>

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

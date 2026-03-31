"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Check, X } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { formatIDR } from "@/lib/utils"
import { moveInvoiceToSent, cancelInvoice } from "@/lib/actions/finance-invoices"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "sonner"

// ─── Types ───────────────────────────────────────────────────────
interface PendingItem {
    id: string
    invoiceNumber: string
    customerName?: string
    supplierName?: string
    customerId?: string
    supplierId?: string
    totalAmount: number
    createdAt: Date | string
    dueDate: Date | string | null
}

interface PendingApprovalSectionProps {
    items: PendingItem[]
    type: "AR" | "AP"
}

// ─── Roles allowed to approve ────────────────────────────────────
const APPROVER_ROLES = new Set([
    "ROLE_CEO", "CEO",
    "ROLE_DIRECTOR", "DIRECTOR",
    "OWNER", "ROLE_OWNER",
    "FINANCE_MANAGER",
    "ROLE_ACCOUNTANT", "ACCOUNTANT",
])

// ─── Date formatter ──────────────────────────────────────────────
function fmtDate(d: Date | string | null): string {
    if (!d) return "-"
    const date = typeof d === "string" ? new Date(d) : d
    if (isNaN(date.getTime())) return "-"
    return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

// ─── Component ───────────────────────────────────────────────────
export function PendingApprovalSection({ items, type }: PendingApprovalSectionProps) {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [loadingId, setLoadingId] = useState<string | null>(null)

    if (!items || items.length === 0) return null

    const canApprove = user?.role ? APPROVER_ROLES.has(user.role) : false
    const totalAmount = items.reduce((sum, i) => sum + (Number(i.totalAmount) || 0), 0)

    async function invalidateAll() {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["finance", "ar-aging"] }),
            queryClient.invalidateQueries({ queryKey: ["finance", "ap-aging"] }),
            queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all }),
            queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all }),
        ])
    }

    async function handleApprove(item: PendingItem) {
        setLoadingId(item.id)
        try {
            const result = await moveInvoiceToSent(item.id)
            if (result && "error" in result && result.error) {
                toast.error(`Gagal menyetujui ${item.invoiceNumber}: ${result.error}`)
            } else {
                toast.success(`${item.invoiceNumber} disetujui`)
                await invalidateAll()
            }
        } catch (err: any) {
            toast.error(err.message || "Gagal menyetujui invoice")
        } finally {
            setLoadingId(null)
        }
    }

    async function handleReject(item: PendingItem) {
        const reason = window.prompt("Alasan penolakan (opsional):")
        if (reason === null) return // user cancelled prompt

        setLoadingId(item.id)
        try {
            const result = await cancelInvoice(item.id, reason || undefined)
            if (result && !result.success) {
                toast.error(`Gagal menolak ${item.invoiceNumber}: ${result.error}`)
            } else {
                toast.success(`${item.invoiceNumber} ditolak`)
                await invalidateAll()
            }
        } catch (err: any) {
            toast.error(err.message || "Gagal menolak invoice")
        } finally {
            setLoadingId(null)
        }
    }

    return (
        <div className="border-2 border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 shadow-[3px_3px_0px_0px_rgba(217,119,6,0.3)]">
            {/* Header */}
            <div className="px-4 py-2.5 flex items-center justify-between border-b border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        Menunggu Persetujuan ({items.length})
                    </span>
                </div>
                <span className="text-xs font-bold font-mono text-amber-700 dark:text-amber-400">
                    {formatIDR(totalAmount)}
                </span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-amber-100 dark:divide-amber-900/50">
                {items.map((item) => {
                    const partyName = type === "AR" ? item.customerName : item.supplierName
                    const isLoading = loadingId === item.id

                    return (
                        <div
                            key={item.id}
                            className="px-4 py-2 flex items-center gap-3 text-sm"
                        >
                            {/* Invoice number + badge */}
                            <div className="flex items-center gap-2 min-w-0 shrink-0">
                                <span className="font-bold text-xs text-zinc-800 dark:text-zinc-200 font-mono">
                                    {item.invoiceNumber}
                                </span>
                                <span className="bg-amber-200/60 text-amber-700 text-[9px] uppercase px-1.5 py-0.5 border border-amber-300 font-bold">
                                    DRAFT
                                </span>
                            </div>

                            {/* Party name */}
                            <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate flex-1 min-w-0">
                                {partyName || "-"}
                            </span>

                            {/* Due date */}
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-500 shrink-0 font-mono">
                                {fmtDate(item.dueDate)}
                            </span>

                            {/* Amount */}
                            <span className="text-xs font-bold font-mono text-zinc-800 dark:text-zinc-200 shrink-0 min-w-[100px] text-right">
                                {formatIDR(Number(item.totalAmount) || 0)}
                            </span>

                            {/* Action buttons or waiting text */}
                            <div className="flex items-center gap-1 shrink-0 ml-1">
                                {canApprove ? (
                                    <>
                                        <button
                                            onClick={() => handleApprove(item)}
                                            disabled={isLoading}
                                            className="bg-emerald-600 text-white rounded-none h-7 text-[9px] font-black uppercase px-2.5 border border-emerald-700 hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                                        >
                                            <Check className="h-3 w-3" />
                                            Setujui
                                        </button>
                                        <button
                                            onClick={() => handleReject(item)}
                                            disabled={isLoading}
                                            className="text-red-600 border border-red-300 rounded-none h-7 text-[9px] font-black uppercase px-2.5 bg-white dark:bg-transparent hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-50 flex items-center gap-1"
                                        >
                                            <X className="h-3 w-3" />
                                            Tolak
                                        </button>
                                    </>
                                ) : (
                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium italic">
                                        Menunggu persetujuan
                                    </span>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

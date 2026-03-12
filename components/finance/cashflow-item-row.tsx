"use client"

import { useState, useCallback } from "react"
import { cn, formatCurrency } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CashflowPartialIndicator } from "./cashflow-partial-indicator"
import { IconPencil } from "@tabler/icons-react"

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
    AR_INVOICE:        { bg: "bg-emerald-50", border: "border-l-emerald-500", text: "text-emerald-700", label: "Piutang" },
    AP_BILL:           { bg: "bg-orange-50",  border: "border-l-orange-500",  text: "text-orange-700",  label: "Hutang" },
    PO_DIRECT:         { bg: "bg-amber-50",   border: "border-l-amber-500",   text: "text-amber-700",   label: "PO" },
    PAYROLL:           { bg: "bg-blue-50",    border: "border-l-blue-500",    text: "text-blue-700",    label: "Gaji" },
    BPJS:              { bg: "bg-indigo-50",  border: "border-l-indigo-500",  text: "text-indigo-700",  label: "BPJS" },
    PETTY_CASH:        { bg: "bg-slate-50",   border: "border-l-slate-500",   text: "text-slate-700",   label: "Kas Kecil" },
    RECURRING_JOURNAL: { bg: "bg-purple-50",  border: "border-l-purple-500",  text: "text-purple-700",  label: "Berulang" },
    BUDGET_ALLOCATION: { bg: "bg-blue-50",    border: "border-l-blue-500",    text: "text-blue-700",    label: "Anggaran" },
    WO_COST:           { bg: "bg-rose-50",    border: "border-l-rose-500",    text: "text-rose-700",    label: "Produksi" },
    LOAN_REPAYMENT:    { bg: "bg-red-50",     border: "border-l-red-500",     text: "text-red-700",     label: "Pinjaman" },
    LOAN_DISBURSEMENT: { bg: "bg-teal-50",    border: "border-l-teal-500",    text: "text-teal-700",    label: "Pencairan" },
    FUNDING_CAPITAL:   { bg: "bg-teal-50",    border: "border-l-teal-500",    text: "text-teal-700",    label: "Modal" },
    EQUITY_WITHDRAWAL: { bg: "bg-red-50",     border: "border-l-red-500",     text: "text-red-700",     label: "Prive" },
    MANUAL:            { bg: "bg-zinc-50",    border: "border-l-zinc-500",    text: "text-zinc-700",    label: "Manual" },
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    DRAFT:            { bg: "bg-zinc-100",    text: "text-zinc-600" },
    PENDING:          { bg: "bg-yellow-100",  text: "text-yellow-700" },
    PENDING_APPROVAL: { bg: "bg-yellow-100",  text: "text-yellow-700" },
    APPROVED:         { bg: "bg-emerald-100", text: "text-emerald-700" },
    CONFIRMED:        { bg: "bg-emerald-100", text: "text-emerald-700" },
    ORDERED:          { bg: "bg-blue-100",    text: "text-blue-700" },
    RECEIVED:         { bg: "bg-emerald-100", text: "text-emerald-700" },
    COMPLETED:        { bg: "bg-emerald-100", text: "text-emerald-700" },
    LUNAS:            { bg: "bg-emerald-100", text: "text-emerald-700" },
    SEBAGIAN:         { bg: "bg-amber-100",   text: "text-amber-700" },
}

interface CashflowItemRowProps {
    id: string
    description: string
    amount: number
    direction: "IN" | "OUT"
    category: string
    status?: string
    source?: string
    simulasi?: boolean
    enabled?: boolean
    overrideAmount?: number | null
    onToggle?: (id: string, enabled: boolean) => void
    onAmountChange?: (id: string, amount: number) => void
    totalAmount?: number | null
    paidPercentage?: number
}

export function CashflowItemRow({
    id, description, amount, direction, category, status, source,
    simulasi = false, enabled = true, overrideAmount, onToggle, onAmountChange,
    totalAmount, paidPercentage,
}: CashflowItemRowProps) {
    const [editing, setEditing] = useState(false)
    const [editValue, setEditValue] = useState("")
    const colors = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.MANUAL
    const statusColor = status ? STATUS_COLORS[status] ?? STATUS_COLORS.DRAFT : null
    const displayAmount = overrideAmount ?? amount
    const isPartial = totalAmount != null && paidPercentage != null && paidPercentage < 100

    const handleEdit = useCallback(() => {
        setEditValue(String(displayAmount))
        setEditing(true)
    }, [displayAmount])

    const handleSave = useCallback(() => {
        const parsed = parseFloat(editValue.replace(/[^0-9.]/g, ""))
        if (!isNaN(parsed) && parsed >= 0) {
            onAmountChange?.(id, parsed)
        }
        setEditing(false)
    }, [editValue, id, onAmountChange])

    return (
        <div className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded border-l-3 text-xs",
            colors.bg, colors.border,
            !enabled && simulasi && "opacity-40 line-through"
        )}>
            {simulasi && (
                <Checkbox
                    checked={enabled}
                    onCheckedChange={(checked) => onToggle?.(id, !!checked)}
                    className="h-3.5 w-3.5"
                />
            )}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className={cn("font-medium truncate", colors.text)}>{description}</span>
                    {source && <span className="text-zinc-400 text-[10px]">{source}</span>}
                </div>
                {isPartial && !simulasi && (
                    <CashflowPartialIndicator
                        paidAmount={displayAmount}
                        totalAmount={totalAmount!}
                        percentage={paidPercentage!}
                    />
                )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
                {statusColor && status && (
                    <Badge variant="outline" className={cn("text-[10px] h-4 px-1", statusColor.bg, statusColor.text)}>
                        {status}
                    </Badge>
                )}
                <Badge variant="outline" className={cn("text-[10px] h-4 px-1", colors.bg, colors.text)}>
                    {colors.label}
                </Badge>
                {simulasi && editing ? (
                    <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={(e) => e.key === "Enter" && handleSave()}
                        className="w-24 h-6 text-xs text-right"
                        autoFocus
                    />
                ) : (
                    <span className={cn(
                        "font-mono font-medium text-right w-24",
                        direction === "IN" ? "text-emerald-700" : "text-red-600"
                    )}>
                        {direction === "IN" ? "+" : "-"}{formatCurrency(displayAmount)}
                    </span>
                )}
                {simulasi && !editing && (
                    <button onClick={handleEdit} className="p-0.5 hover:bg-zinc-200 rounded">
                        <IconPencil size={12} className="text-zinc-400" />
                    </button>
                )}
            </div>
        </div>
    )
}

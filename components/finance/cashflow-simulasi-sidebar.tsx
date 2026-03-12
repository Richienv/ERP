"use client"

import { useState } from "react"
import { cn, formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { CashflowScenarioDialog } from "./cashflow-scenario-dialog"
import { IconPlus, IconDotsVertical, IconTrash, IconPencil } from "@tabler/icons-react"
import type { CashflowScenarioSummary } from "@/lib/actions/finance-cashflow"

const SOURCE_LABELS: Record<string, string> = {
    AR_INVOICE: "Piutang (AR)",
    AP_BILL: "Hutang (AP)",
    PO_DIRECT: "Purchase Order",
    PAYROLL: "Gaji Karyawan",
    BPJS: "BPJS",
    PETTY_CASH: "Peti Kas",
    WO_COST: "Biaya Produksi",
    LOAN_REPAYMENT: "Cicilan Pinjaman",
    LOAN_DISBURSEMENT: "Pencairan Pinjaman",
    FUNDING_CAPITAL: "Modal Masuk",
    EQUITY_WITHDRAWAL: "Prive",
    RECURRING_JOURNAL: "Jurnal Berulang",
    BUDGET_ALLOCATION: "Anggaran",
    MANUAL: "Manual",
}

const ALL_SOURCES = Object.keys(SOURCE_LABELS)

interface SimulasiSidebarProps {
    scenarios: CashflowScenarioSummary[]
    activeScenarioId: string | null
    disabledSources: string[]
    onSelectScenario: (id: string) => void
    onCreateScenario: (name: string) => void
    onRenameScenario: (id: string, name: string) => void
    onDeleteScenario: (id: string) => void
    onToggleSource: (source: string) => void
}

export function CashflowSimulasiSidebar({
    scenarios, activeScenarioId, disabledSources,
    onSelectScenario, onCreateScenario, onRenameScenario, onDeleteScenario, onToggleSource,
}: SimulasiSidebarProps) {
    const [dialogOpen, setDialogOpen] = useState(false)
    const [dialogMode, setDialogMode] = useState<"create" | "rename">("create")
    const [renameId, setRenameId] = useState<string | null>(null)
    const [renameName, setRenameName] = useState("")

    const handleCreate = () => {
        setDialogMode("create")
        setRenameName("")
        setDialogOpen(true)
    }

    const handleRename = (id: string, currentName: string) => {
        setDialogMode("rename")
        setRenameId(id)
        setRenameName(currentName)
        setDialogOpen(true)
    }

    const handleDialogSave = (name: string) => {
        if (dialogMode === "create") {
            onCreateScenario(name)
        } else if (renameId) {
            onRenameScenario(renameId, name)
        }
    }

    return (
        <div className="w-[260px] shrink-0 border-r-2 border-black bg-zinc-50 flex flex-col h-full overflow-y-auto">
            {/* Skenario Section */}
            <div className="p-3 border-b border-zinc-200">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500">Skenario</h3>
                    <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={handleCreate}>
                        <IconPlus size={14} />
                    </Button>
                </div>
                <div className="space-y-1">
                    {scenarios.length === 0 && (
                        <p className="text-xs text-zinc-400 italic">Belum ada skenario</p>
                    )}
                    {scenarios.map((s) => (
                        <div
                            key={s.id}
                            className={cn(
                                "flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer text-xs group",
                                activeScenarioId === s.id
                                    ? "bg-emerald-100 border border-emerald-300 font-medium"
                                    : "hover:bg-zinc-100 border border-transparent"
                            )}
                            onClick={() => onSelectScenario(s.id)}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="truncate">{s.name}</div>
                                <div className="text-[10px] text-zinc-400">
                                    Net {formatCurrency(s.netFlow)}
                                </div>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-zinc-200 rounded"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <IconDotsVertical size={12} />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleRename(s.id, s.name)}>
                                        <IconPencil size={14} className="mr-1.5" /> Ubah Nama
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-red-600" onClick={() => onDeleteScenario(s.id)}>
                                        <IconTrash size={14} className="mr-1.5" /> Hapus
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ))}
                </div>
            </div>

            {/* Sumber Section */}
            <div className="p-3 flex-1">
                <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-2">Sumber Data</h3>
                <div className="space-y-1.5">
                    {ALL_SOURCES.map((source) => (
                        <label key={source} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-zinc-100 px-1.5 py-1 rounded">
                            <Checkbox
                                checked={!disabledSources.includes(source)}
                                onCheckedChange={() => onToggleSource(source)}
                                className="h-3.5 w-3.5"
                            />
                            <span>{SOURCE_LABELS[source]}</span>
                        </label>
                    ))}
                </div>
            </div>

            <CashflowScenarioDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSave={handleDialogSave}
                initialName={renameName}
                mode={dialogMode}
            />
        </div>
    )
}

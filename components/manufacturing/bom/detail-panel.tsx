"use client"

import { useState, useMemo } from "react"
import { SubkonSelector } from "./subkon-selector"
import { InHouseAllocator } from "./inhouse-allocator"
import { calcItemCostPerUnit, calcStepMaterialCost, calcLaborCostPerPcs, type BOMItemWithCost } from "./bom-cost-helpers"
import { useWorkingHours } from "@/hooks/use-working-hours"
import { formatCurrency } from "@/lib/inventory-utils"
import { useEmployees } from "@/hooks/use-employees"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Paperclip, Upload, X, Clock, Cog, Building2, Truck,
    CheckCircle2, Timer, User, GitBranch, ChevronDown, ChevronUp,
    FileText, BarChart3, Maximize2, Minimize2,
} from "lucide-react"

/* ── Section Card ── */
function SectionCard({ title, icon, accent = "bg-zinc-500", tint = "bg-white", children, collapsible, defaultOpen = true, className, stretch }: {
    title: string
    icon?: React.ReactNode
    accent?: string
    tint?: string
    children: React.ReactNode
    collapsible?: boolean
    defaultOpen?: boolean
    className?: string
    stretch?: boolean
}) {
    const [open, setOpen] = useState(defaultOpen)
    return (
        <div className={`border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden ${stretch ? "flex flex-col" : ""} ${className || ""}`}>
            <button
                type="button"
                onClick={collapsible ? () => setOpen(!open) : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2 ${tint} ${collapsible ? "cursor-pointer hover:brightness-95" : "cursor-default"} transition-all shrink-0`}
            >
                <div className={`${accent} text-white p-1 shrink-0`}>
                    {icon}
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-700 flex-1 text-left">{title}</span>
                {collapsible && (
                    <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
                )}
            </button>
            {(!collapsible || open) && (
                <div className={`px-3 pb-3 pt-2.5 bg-white border-t border-zinc-100 ${stretch ? "flex-1" : ""}`}>{children}</div>
            )}
        </div>
    )
}

/* ── Field Label ── */
function FieldLabel({ icon, children, required }: { icon?: React.ReactNode; children: React.ReactNode; required?: boolean }) {
    return (
        <label className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500 mb-1.5 flex items-center gap-1.5">
            {icon && <span className="text-zinc-400">{icon}</span>}
            {children}
            {required && <span className="text-red-500 text-xs">*</span>}
        </label>
    )
}

/* ── Props ── */
interface DetailPanelProps {
    step: any
    totalQty: number
    allItems: any[]
    allStations?: any[]
    onUpdateStep: (field: string, value: any) => void
    onChangeStation?: (stationId: string, station: any) => void
    onUpdateAllocations: (allocations: any[]) => void
    onUploadAttachment: () => void
    onDeleteAttachment: (id: string) => void
    onToggleSubkon: (useSubkon: boolean) => void
}

export function DetailPanel({
    step, totalQty, allItems, allStations,
    onUpdateStep, onChangeStation, onUpdateAllocations,
    onUploadAttachment, onDeleteAttachment,
    onToggleSubkon,
}: DetailPanelProps) {
    const [showInhouseAlloc, setShowInhouseAlloc] = useState(false)
    const [expanded, setExpanded] = useState(false)
    const [collapsed, setCollapsed] = useState(false)
    const { data: employees } = useEmployees()
    const workingHoursPerMonth = useWorkingHours()

    const employeeOptions = useMemo(() => {
        if (!employees) return []
        return employees
            .filter((e: any) => e.status === "ACTIVE")
            .map((e: any) => ({
                id: e.id,
                name: `${e.firstName}${e.lastName ? " " + e.lastName : ""}`,
                position: e.position || "",
                department: e.department || "",
                salary: Number(e.baseSalary || 0),
            }))
    }, [employees])

    if (!step) return null

    const isSubkon = step.useSubkon ?? step.station?.operationType === "SUBCONTRACTOR"
    const hasInhouseAllocations = !isSubkon && (step.allocations || []).length > 0
    const showAllocPanel = showInhouseAlloc || hasInhouseAllocations

    // Materials
    const stepMaterials = (step.materials || []).map((sm: any) => {
        const item = (allItems || []).find((i: any) => i.id === sm.bomItemId)
        return { ...sm, item }
    }).filter((sm: any) => sm.item)

    const stepMaterialTotal = calcStepMaterialCost(step, allItems || [], totalQty)
    const laborCostPerPcs = calcLaborCostPerPcs(step.laborMonthlySalary, step.durationMinutes, workingHoursPerMonth)
    const stepLaborTotal = laborCostPerPcs > 0 ? laborCostPerPcs * totalQty : Number(step.station?.costPerUnit || 0) * totalQty

    const durationMin = Number(step.durationMinutes || 0)

    const sameTypeStations = (allStations || []).filter((s: any) =>
        s.stationType === step.station?.stationType &&
        s.operationType !== "SUBCONTRACTOR" &&
        s.isActive !== false
    )

    const completedQty = step.completedQty ?? 0
    const progressPct = totalQty > 0 ? Math.min(100, (completedQty / totalQty) * 100) : 0

    return (
        <div className={`border-t-2 border-black bg-zinc-50 shrink-0 flex flex-col ${expanded ? "absolute inset-0 z-50" : ""}`}>
            {/* ── HEADER BAR ── */}
            <div className="flex items-center gap-3 px-5 py-2.5 bg-white border-b-2 border-black shrink-0">
                <div className={`p-2 ${isSubkon ? "bg-amber-500" : "bg-emerald-500"} text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`}>
                    <Cog className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-black text-base uppercase tracking-tight truncate">{step.station?.name}</h3>
                    {isSubkon && step.subkonProcessType && (
                        <p className="text-[10px] font-bold text-amber-600 truncate">{step.subkonProcessType}</p>
                    )}
                </div>

                {/* Expand / Collapse controls */}
                <button
                    type="button"
                    onClick={() => { setCollapsed(!collapsed); if (expanded) setExpanded(false) }}
                    className="p-1.5 border-2 border-black hover:bg-zinc-100 transition-colors"
                    title={collapsed ? "Tampilkan detail" : "Sembunyikan detail"}
                >
                    {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                <button
                    type="button"
                    onClick={() => { setExpanded(!expanded); setCollapsed(false) }}
                    className="p-1.5 border-2 border-black hover:bg-zinc-100 transition-colors"
                    title={expanded ? "Kecilkan panel" : "Perbesar panel"}
                >
                    {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>

                {/* In-House / Subkon toggle */}
                <div className="flex border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0">
                    <button
                        type="button"
                        onClick={() => onToggleSubkon(false)}
                        className={`px-3.5 py-1.5 text-[10px] font-black uppercase flex items-center gap-1.5 transition-colors ${
                            !isSubkon ? "bg-emerald-400 text-black" : "bg-white text-zinc-400 hover:bg-zinc-50"
                        }`}
                    >
                        <Building2 className="h-3 w-3" /> In-House
                    </button>
                    <button
                        type="button"
                        onClick={() => onToggleSubkon(true)}
                        className={`px-3.5 py-1.5 text-[10px] font-black uppercase flex items-center gap-1.5 border-l-2 border-black transition-colors ${
                            isSubkon ? "bg-amber-400 text-black" : "bg-white text-zinc-400 hover:bg-zinc-50"
                        }`}
                    >
                        <Truck className="h-3 w-3" /> Subkon
                    </button>
                </div>
            </div>

            {/* ── BODY — hidden when collapsed ── */}
            {!collapsed && (
                <div className={`overflow-y-auto px-5 py-4 space-y-4 ${expanded ? "flex-1" : "max-h-[420px]"}`}>

                    {/* ROW 1: 2-column grid — Config | Allocation + Attachments stacked */}
                    <div className="grid grid-cols-2 gap-4 items-stretch">

                        {/* LEFT: Pengaturan Proses — stretches to match right column height */}
                        <SectionCard
                            title="Pengaturan Proses"
                            icon={<Cog className="h-3 w-3" />}
                            accent={isSubkon ? "bg-amber-500" : "bg-emerald-500"}
                            tint={isSubkon ? "bg-amber-50" : "bg-emerald-50"}
                            stretch
                        >
                            <div className="space-y-4">
                                {/* Work Center select — in-house only, multiple options */}
                                {!isSubkon && sameTypeStations.length > 1 && onChangeStation && (
                                    <div>
                                        <FieldLabel icon={<Building2 className="h-3 w-3" />}>Work Center</FieldLabel>
                                        <Select
                                            value={step.stationId || step.station?.id || ""}
                                            onValueChange={(val) => {
                                                const station = allStations?.find((s: any) => s.id === val)
                                                if (station) onChangeStation(val, station)
                                            }}
                                        >
                                            <SelectTrigger className="h-9 text-xs font-bold border-2 border-zinc-300 rounded-none hover:border-black transition-colors focus:border-black">
                                                <SelectValue placeholder="Pilih work center" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {sameTypeStations.map((s: any) => (
                                                    <SelectItem key={s.id} value={s.id} className="text-xs">
                                                        {s.name} {s.code ? `(${s.code})` : ""}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Tipe Proses — subkon only */}
                                {isSubkon && (
                                    <div>
                                        <FieldLabel icon={<Cog className="h-3 w-3" />}>Tipe Proses</FieldLabel>
                                        <Select
                                            value={step.subkonProcessType || "__none__"}
                                            onValueChange={(val) => onUpdateStep("subkonProcessType", val === "__none__" ? null : val)}
                                        >
                                            <SelectTrigger className="h-9 text-xs border-2 border-zinc-300 rounded-none hover:border-black transition-colors focus:border-black">
                                                <SelectValue placeholder="Pilih tipe..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none__" className="text-xs text-zinc-400">— Pilih tipe —</SelectItem>
                                                {[
                                                    { value: "CUTTING", label: "Potong" },
                                                    { value: "SEWING", label: "Jahit" },
                                                    { value: "WASHING", label: "Cuci" },
                                                    { value: "PRINTING", label: "Sablon" },
                                                    { value: "EMBROIDERY", label: "Bordir" },
                                                    { value: "QC", label: "Quality Control" },
                                                    { value: "PACKING", label: "Packing" },
                                                    { value: "FINISHING", label: "Finishing" },
                                                    { value: "OTHER", label: "Lainnya" },
                                                ].map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Duration */}
                                <div>
                                    <FieldLabel icon={<Clock className="h-3 w-3" />} required>Durasi /pcs (menit)</FieldLabel>
                                    <Input
                                        type="number"
                                        min={0}
                                        value={step.durationMinutes || ""}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value)
                                            onUpdateStep("durationMinutes", isNaN(val) ? null : Math.max(0, val))
                                        }}
                                        className="h-9 text-sm font-mono font-bold border-2 border-zinc-300 rounded-none placeholder:text-zinc-300 hover:border-black transition-colors focus:border-black"
                                        placeholder="0"
                                    />
                                </div>

                                {/* Operator — in-house only */}
                                {!isSubkon && (
                                    <div>
                                        <FieldLabel icon={<User className="h-3 w-3" />}>Operator</FieldLabel>
                                        <Select
                                            value={
                                                employeeOptions.find((e: any) => e.name === step.operatorName)?.id || "__manual__"
                                            }
                                            onValueChange={(val) => {
                                                if (val === "__manual__") {
                                                    onUpdateStep("operatorName", null)
                                                    return
                                                }
                                                const emp = employeeOptions.find((e: any) => e.id === val)
                                                if (emp) {
                                                    onUpdateStep("operatorName", emp.name)
                                                    if (emp.salary > 0) {
                                                        onUpdateStep("laborMonthlySalary", emp.salary)
                                                    }
                                                }
                                            }}
                                        >
                                            <SelectTrigger className="h-9 text-xs font-bold border-2 border-zinc-300 rounded-none hover:border-black transition-colors focus:border-black">
                                                <SelectValue placeholder="Pilih karyawan..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__manual__" className="text-xs text-zinc-400">
                                                    — Kosongkan —
                                                </SelectItem>
                                                {employeeOptions.map((emp: any) => (
                                                    <SelectItem key={emp.id} value={emp.id} className="text-xs">
                                                        {emp.name}
                                                        {emp.position && <span className="text-zinc-400 ml-1">({emp.position})</span>}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {step.operatorName && !employeeOptions.find((e: any) => e.name === step.operatorName) && (
                                            <div className="mt-1.5 px-2 py-1 bg-amber-50 border border-amber-200">
                                                <p className="text-[10px] text-amber-700 font-bold">
                                                    Manual: {step.operatorName}
                                                </p>
                                            </div>
                                        )}
                                        {/* Inline salary indicator — value sourced from HCM */}
                                        {Number(step.laborMonthlySalary || 0) > 0 ? (
                                            <p className="mt-1 text-[9px] font-bold text-zinc-400" title="Atur gaji di modul HCM → Master Karyawan">
                                                Gaji: {formatCurrency(Number(step.laborMonthlySalary))} /bln
                                                {laborCostPerPcs > 0 && <span className="ml-1 text-emerald-600">({formatCurrency(laborCostPerPcs)}/pcs)</span>}
                                            </p>
                                        ) : (
                                            <p className="mt-1 text-[9px] text-zinc-300 font-bold" title="Atur gaji di modul HCM → Master Karyawan">
                                                Gaji dari HCM
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Catatan */}
                                <div>
                                    <FieldLabel icon={<FileText className="h-3 w-3" />}>Catatan</FieldLabel>
                                    <Textarea
                                        value={step.notes || ""}
                                        onChange={(e) => onUpdateStep("notes", e.target.value)}
                                        className="text-xs border-2 border-zinc-300 rounded-none min-h-[36px] h-9 placeholder:text-zinc-300 hover:border-black transition-colors focus:border-black"
                                        placeholder="Tulis catatan..."
                                    />
                                </div>
                            </div>
                        </SectionCard>

                        {/* RIGHT: Allocation + Attachments stacked — stretches to match left */}
                        <div className="flex flex-col gap-4">
                            {/* Subkon selector or In-House allocator */}
                            {isSubkon ? (
                                <SectionCard
                                    title="Subkontraktor"
                                    icon={<Truck className="h-3 w-3" />}
                                    accent="bg-amber-500"
                                    tint="bg-amber-50"
                                    stretch
                                    className="flex-1"
                                >
                                    <SubkonSelector
                                        stationType={step.station?.stationType}
                                        allocations={step.allocations || []}
                                        totalQty={totalQty}
                                        onChange={onUpdateAllocations}
                                    />
                                </SectionCard>
                            ) : showAllocPanel ? (
                                <SectionCard
                                    title="Distribusi Work Center"
                                    icon={<GitBranch className="h-3 w-3" />}
                                    accent="bg-indigo-500"
                                    tint="bg-indigo-50"
                                    stretch
                                    className="flex-1"
                                >
                                    <InHouseAllocator
                                        stationType={step.station?.stationType}
                                        allocations={step.allocations || []}
                                        totalQty={totalQty}
                                        onChange={onUpdateAllocations}
                                    />
                                    {(step.allocations || []).length === 0 && (
                                        <button
                                            onClick={() => setShowInhouseAlloc(false)}
                                            className="mt-2 text-[10px] font-bold text-zinc-400 hover:text-red-500 transition-colors"
                                        >
                                            Batalkan distribusi
                                        </button>
                                    )}
                                </SectionCard>
                            ) : (
                                <button
                                    onClick={() => setShowInhouseAlloc(true)}
                                    className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-zinc-300 text-[11px] font-black uppercase tracking-wider text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 transition-all"
                                >
                                    <GitBranch className="h-3.5 w-3.5" /> Distribusi ke multi work center
                                </button>
                            )}

                            {/* Attachments */}
                            <SectionCard
                                title="Lampiran"
                                icon={<Paperclip className="h-3 w-3" />}
                                accent="bg-blue-500"
                                tint="bg-blue-50"
                                stretch
                                className="flex-1"
                            >
                                <div className="space-y-2">
                                    {(step.attachments || []).map((att: any) => (
                                        <div key={att.id} className="flex items-center gap-2 text-xs group px-2 py-1.5 bg-zinc-50 border border-zinc-200 hover:border-zinc-400 transition-colors">
                                            <Paperclip className="h-3 w-3 text-blue-400 shrink-0" />
                                            <a href={att.fileUrl} target="_blank" rel="noreferrer" className="font-bold truncate flex-1 hover:text-blue-600 transition-colors">{att.fileName}</a>
                                            <span className="text-[9px] text-zinc-400 font-mono">{(att.fileSize / 1024).toFixed(0)}KB</span>
                                            <button onClick={() => onDeleteAttachment(att.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <X className="h-3 w-3 text-zinc-400 hover:text-red-500" />
                                            </button>
                                        </div>
                                    ))}
                                    {(step.attachments || []).length === 0 && (
                                        <p className="text-[11px] text-zinc-300 font-bold text-center py-2">Belum ada lampiran</p>
                                    )}
                                </div>
                                <Button onClick={onUploadAttachment} variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase tracking-wider rounded-none border-2 border-dashed border-zinc-300 hover:border-black w-full mt-2.5 transition-colors">
                                    <Upload className="mr-1.5 h-3 w-3" /> Upload File
                                </Button>
                            </SectionCard>
                        </div>
                    </div>

                    {/* ROW 2: 2-column grid — Production | Material Costs */}
                    <div className="grid grid-cols-2 gap-4 items-stretch">
                        {/* Production tracking */}
                        <SectionCard
                            title="Produksi"
                            icon={<CheckCircle2 className="h-3 w-3" />}
                            accent="bg-emerald-500"
                            tint="bg-emerald-50"
                            stretch
                        >
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        min={0}
                                        max={totalQty}
                                        value={completedQty || ""}
                                        onChange={(e) => onUpdateStep("completedQty", e.target.value ? parseInt(e.target.value) : 0)}
                                        className="h-9 text-sm font-mono font-bold border-2 border-zinc-300 rounded-none flex-1 placeholder:text-zinc-300 hover:border-black transition-colors focus:border-black"
                                        placeholder="0"
                                    />
                                    <span className="text-[11px] font-black text-zinc-400 whitespace-nowrap">/ {totalQty} pcs</span>
                                </div>
                                {totalQty > 0 && (
                                    <div>
                                        <div className="h-3 bg-zinc-200 border border-zinc-300 overflow-hidden">
                                            <div
                                                className={`h-full transition-all ${
                                                    progressPct >= 100 ? "bg-emerald-500" : progressPct > 0 ? "bg-amber-400" : "bg-zinc-200"
                                                }`}
                                                style={{ width: `${progressPct}%` }}
                                            />
                                        </div>
                                        <p className="text-[10px] font-black text-zinc-500 mt-1 text-right">
                                            {progressPct.toFixed(0)}% selesai
                                        </p>
                                    </div>
                                )}
                            </div>
                        </SectionCard>

                        {/* Material cost breakdown */}
                        <SectionCard
                            title="Biaya Material"
                            icon={<BarChart3 className="h-3 w-3" />}
                            accent="bg-violet-500"
                            tint="bg-violet-50"
                            stretch
                        >
                            {stepMaterials.length === 0 ? (
                                <p className="text-xs text-zinc-300 font-bold py-3 text-center">Belum ada material di proses ini</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b-2 border-zinc-200">
                                                <th className="text-left text-[9px] font-black uppercase tracking-wider text-zinc-500 pb-2 pr-3">Material</th>
                                                <th className="text-right text-[9px] font-black uppercase tracking-wider text-zinc-500 pb-2 px-2">Qty/Unit</th>
                                                <th className="text-right text-[9px] font-black uppercase tracking-wider text-zinc-500 pb-2 px-2">Harga</th>
                                                <th className="text-right text-[9px] font-black uppercase tracking-wider text-zinc-500 pb-2 px-2">&times; {totalQty}</th>
                                                <th className="text-right text-[9px] font-black uppercase tracking-wider text-zinc-500 pb-2 pl-2">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stepMaterials.map((sm: any, idx: number) => {
                                                const item = sm.item as BOMItemWithCost
                                                const costPerUnit = calcItemCostPerUnit(item)
                                                const subtotal = costPerUnit * totalQty
                                                return (
                                                    <tr key={sm.bomItemId} className={`border-b border-zinc-100 ${idx % 2 === 0 ? "bg-zinc-50/50" : ""}`}>
                                                        <td className="py-2 pr-3 font-bold truncate max-w-[180px]">{item.material?.name || "-"}</td>
                                                        <td className="py-2 px-2 text-right font-mono text-zinc-600">
                                                            {Number(item.quantityPerUnit || 0)} {item.unit || item.material?.unit || ""}
                                                        </td>
                                                        <td className="py-2 px-2 text-right font-mono text-zinc-600">{formatCurrency(Number(item.material?.costPrice || 0))}</td>
                                                        <td className="py-2 px-2 text-right font-mono text-zinc-600">{(Number(item.quantityPerUnit || 0) * totalQty).toLocaleString("id-ID")}</td>
                                                        <td className="py-2 pl-2 text-right font-black">{formatCurrency(subtotal)}</td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t-2 border-zinc-200">
                                                <td colSpan={4} className="py-2 text-right text-[10px] font-black uppercase tracking-wider text-zinc-500 pr-2">Total Material</td>
                                                <td className="py-2 text-right font-black text-sm">{formatCurrency(stepMaterialTotal)}</td>
                                            </tr>
                                            {stepLaborTotal > 0 && (
                                                <tr>
                                                    <td colSpan={4} className="py-1.5 text-right text-[10px] font-black uppercase tracking-wider text-zinc-500 pr-2">
                                                        Labor/Proses
                                                        {laborCostPerPcs > 0 && <span className="text-zinc-300 ml-1 normal-case tracking-normal">({formatCurrency(laborCostPerPcs)}/pcs)</span>}
                                                    </td>
                                                    <td className="py-1.5 text-right font-black text-sm">{formatCurrency(stepLaborTotal)}</td>
                                                </tr>
                                            )}
                                            <tr className="border-t-2 border-black bg-zinc-50">
                                                <td colSpan={4} className="py-2 text-right text-[11px] font-black uppercase tracking-wider pr-2">Total Proses</td>
                                                <td className="py-2 text-right font-black text-sm text-emerald-700">{formatCurrency(stepMaterialTotal + stepLaborTotal)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </SectionCard>
                    </div>

                    {/* ROW 3: Time Study — full width, collapsible */}
                    <SectionCard
                        title="Time Study"
                        icon={<Timer className="h-3 w-3" />}
                        accent="bg-cyan-500"
                        tint="bg-cyan-50"
                        collapsible
                        defaultOpen={false}
                    >
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <FieldLabel>Hasil Time Study (menit/pcs)</FieldLabel>
                                <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={step.estimatedTimePerUnit ?? ""}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value)
                                        onUpdateStep("estimatedTimePerUnit", isNaN(val) ? null : Math.max(0, val))
                                    }}
                                    className="h-9 text-sm font-mono font-bold border-2 border-zinc-300 rounded-none placeholder:text-zinc-300 hover:border-black transition-colors focus:border-black"
                                    placeholder="2.5"
                                />
                                {Number(step.estimatedTimePerUnit || 0) > 0 && durationMin > 0 && (
                                    <div className="mt-2.5 space-y-1.5 bg-cyan-50 border-2 border-cyan-200 p-2.5">
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-zinc-500 font-bold">PCC (Durasi /pcs)</span>
                                            <span className="font-mono font-black">{durationMin} menit</span>
                                        </div>
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-zinc-500 font-bold">Time Study</span>
                                            <span className="font-mono font-black">{Number(step.estimatedTimePerUnit)} menit</span>
                                        </div>
                                        <div className="flex justify-between text-[10px] border-t-2 border-cyan-200 pt-1.5 mt-1.5">
                                            <span className="text-zinc-600 font-black">Selisih</span>
                                            {(() => {
                                                const diff = Number(step.estimatedTimePerUnit) - durationMin
                                                const pct = ((diff / durationMin) * 100).toFixed(1)
                                                return (
                                                    <span className={`font-black ${diff < 0 ? "text-emerald-700" : diff > 0 ? "text-red-600" : "text-zinc-500"}`}>
                                                        {diff > 0 ? "+" : ""}{diff.toFixed(2)} menit ({diff > 0 ? "+" : ""}{pct}%)
                                                    </span>
                                                )
                                            })()}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div>
                                <FieldLabel>Waktu Aktual Total (menit)</FieldLabel>
                                <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={step.actualTimeTotal ?? ""}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value)
                                        onUpdateStep("actualTimeTotal", isNaN(val) ? null : Math.max(0, val))
                                    }}
                                    className="h-9 text-sm font-mono font-bold border-2 border-zinc-300 rounded-none placeholder:text-zinc-300 hover:border-black transition-colors focus:border-black"
                                    placeholder="450"
                                />
                                {Number(step.actualTimeTotal || 0) > 0 && completedQty > 0 && (
                                    <div className="mt-2.5 bg-cyan-50 border-2 border-cyan-200 p-2.5">
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-zinc-500 font-bold">Rata-rata</span>
                                            <span className="font-mono font-black">{(Number(step.actualTimeTotal) / completedQty).toFixed(2)} menit/pcs</span>
                                        </div>
                                        <p className="text-[10px] text-zinc-400 mt-1 font-bold">
                                            Berdasarkan {completedQty} pcs selesai
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </SectionCard>
                </div>
            )}
        </div>
    )
}

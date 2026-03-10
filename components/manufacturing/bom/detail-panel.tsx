"use client"

import { useState, useMemo } from "react"
import { SubkonSelector } from "./subkon-selector"
import { InHouseAllocator } from "./inhouse-allocator"
import { calcItemCostPerUnit, calcStepMaterialCost, calcLaborCostPerPcs, WORKING_HOURS_PER_MONTH, type BOMItemWithCost } from "./bom-cost-helpers"
import { formatCurrency } from "@/lib/inventory-utils"
import { useEmployees } from "@/hooks/use-employees"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Paperclip, Upload, X, Clock, Cog, Building2, Truck,
    CheckCircle2, Timer, User, GitBranch, ChevronDown, Banknote,
    FileText, BarChart3,
} from "lucide-react"

/* ── Section Card ── */
function SectionCard({ title, icon, accent = "border-zinc-300", children, collapsible, defaultOpen = true, className }: {
    title: string
    icon?: React.ReactNode
    accent?: string
    children: React.ReactNode
    collapsible?: boolean
    defaultOpen?: boolean
    className?: string
}) {
    const [open, setOpen] = useState(defaultOpen)
    return (
        <div className={`border border-zinc-200 bg-white overflow-hidden ${className || ""}`}>
            <button
                type="button"
                onClick={collapsible ? () => setOpen(!open) : undefined}
                className={`w-full flex items-center gap-2 px-3 py-2 border-l-[3px] ${accent} ${collapsible ? "cursor-pointer hover:bg-zinc-50" : "cursor-default"} transition-colors`}
            >
                {icon}
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 flex-1 text-left">{title}</span>
                {collapsible && (
                    <ChevronDown className={`h-3 w-3 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
                )}
            </button>
            {(!collapsible || open) && (
                <div className="px-3 pb-3 pt-2">{children}</div>
            )}
        </div>
    )
}

/* ── Field Label ── */
function FieldLabel({ icon, children, required }: { icon?: React.ReactNode; children: React.ReactNode; required?: boolean }) {
    return (
        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 flex items-center gap-1">
            {icon}
            {children}
            {required && <span className="text-red-500">*</span>}
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
    const { data: employees } = useEmployees()

    // Build employee options for operator selector
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
    const laborCostPerPcs = calcLaborCostPerPcs(step.laborMonthlySalary, step.durationMinutes)
    const stepLaborTotal = laborCostPerPcs > 0 ? laborCostPerPcs * totalQty : Number(step.station?.costPerUnit || 0) * totalQty

    // Labour calculation
    const durationMin = Number(step.durationMinutes || 0)
    const hoursPerPcs = durationMin > 0 ? durationMin / 60 : 0
    const pcsPerMonth = hoursPerPcs > 0 ? WORKING_HOURS_PER_MONTH / hoursPerPcs : 0

    // Stations of same type
    const sameTypeStations = (allStations || []).filter((s: any) =>
        s.stationType === step.station?.stationType &&
        s.operationType !== "SUBCONTRACTOR" &&
        s.isActive !== false
    )

    // Progress
    const completedQty = step.completedQty ?? 0
    const progressPct = totalQty > 0 ? Math.min(100, (completedQty / totalQty) * 100) : 0

    return (
        <div className="border-t-2 border-black bg-zinc-50/50 shrink-0">
            {/* ── HEADER BAR ── */}
            <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-zinc-200">
                <div className={`p-1.5 ${isSubkon ? "bg-amber-500" : "bg-emerald-500"} text-white shrink-0`}>
                    <Cog className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-black text-sm uppercase truncate">{step.station?.name}</h3>
                    {isSubkon && step.subkonProcessType && (
                        <p className="text-[10px] font-bold text-amber-600 truncate">{step.subkonProcessType}</p>
                    )}
                </div>

                {/* In-House / Subkon toggle */}
                <div className="flex border-2 border-black shrink-0">
                    <button
                        type="button"
                        onClick={() => onToggleSubkon(false)}
                        className={`px-3 py-1 text-[9px] font-black uppercase flex items-center gap-1 transition-colors ${
                            !isSubkon ? "bg-emerald-400 text-black" : "bg-white text-zinc-400 hover:bg-zinc-50"
                        }`}
                    >
                        <Building2 className="h-3 w-3" /> In-House
                    </button>
                    <button
                        type="button"
                        onClick={() => onToggleSubkon(true)}
                        className={`px-3 py-1 text-[9px] font-black uppercase flex items-center gap-1 border-l-2 border-black transition-colors ${
                            isSubkon ? "bg-amber-400 text-black" : "bg-white text-zinc-400 hover:bg-zinc-50"
                        }`}
                    >
                        <Truck className="h-3 w-3" /> Subkon
                    </button>
                </div>
            </div>

            {/* ── BODY ── */}
            <div className="max-h-[380px] overflow-y-auto px-4 py-3 space-y-3">

                {/* ROW 1: Config + Allocation/Subkon + Attachments */}
                <div className="flex gap-3 items-start">

                    {/* LEFT: Pengaturan Proses */}
                    <div className="w-[260px] shrink-0">
                        <SectionCard
                            title="Pengaturan Proses"
                            icon={<Cog className="h-3 w-3 text-zinc-400" />}
                            accent={isSubkon ? "border-amber-400" : "border-emerald-400"}
                        >
                            <div className="space-y-3">
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
                                            <SelectTrigger className="h-8 text-xs font-bold border-zinc-200 rounded-none">
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

                                {/* Tipe Proses — subkon only (dropdown) */}
                                {isSubkon && (
                                    <div>
                                        <FieldLabel icon={<Cog className="h-3 w-3" />}>Tipe Proses</FieldLabel>
                                        <Select
                                            value={step.subkonProcessType || "__none__"}
                                            onValueChange={(val) => onUpdateStep("subkonProcessType", val === "__none__" ? null : val)}
                                        >
                                            <SelectTrigger className="h-8 text-xs border-zinc-200 rounded-none">
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
                                        className="h-8 text-xs font-mono border-zinc-200 rounded-none placeholder:text-zinc-300"
                                        placeholder="0"
                                    />
                                </div>

                                {/* Operator — in-house only (employee selector) */}
                                {!isSubkon && (
                                    <div>
                                        <FieldLabel icon={<User className="h-3 w-3" />}>Operator</FieldLabel>
                                        <Select
                                            value={
                                                // Match by name to find employee id
                                                employeeOptions.find((e: any) => e.name === step.operatorName)?.id || "__manual__"
                                            }
                                            onValueChange={(val) => {
                                                if (val === "__manual__") {
                                                    // Clear to manual mode
                                                    onUpdateStep("operatorName", null)
                                                    return
                                                }
                                                const emp = employeeOptions.find((e: any) => e.id === val)
                                                if (emp) {
                                                    onUpdateStep("operatorName", emp.name)
                                                    // Auto-populate salary from employee data
                                                    if (emp.salary > 0) {
                                                        onUpdateStep("laborMonthlySalary", emp.salary)
                                                    }
                                                }
                                            }}
                                        >
                                            <SelectTrigger className="h-8 text-xs border-zinc-200 rounded-none">
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
                                            <p className="text-[9px] text-amber-600 font-bold mt-1">
                                                Manual: {step.operatorName}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Gaji Bulanan — in-house only, read-only from employee master */}
                                {!isSubkon && (
                                    <div>
                                        <FieldLabel icon={<Banknote className="h-3 w-3" />}>Gaji Bulanan (Rp)</FieldLabel>
                                        {(() => {
                                            const matchedEmp = employeeOptions.find((e: any) => e.name === step.operatorName)
                                            const salaryFromEmp = matchedEmp?.salary || 0
                                            const currentSalary = Number(step.laborMonthlySalary || 0)
                                            return (
                                                <>
                                                    <div className="h-8 flex items-center px-3 text-xs font-mono bg-zinc-50 border border-zinc-200 text-zinc-600">
                                                        {currentSalary > 0
                                                            ? formatCurrency(currentSalary)
                                                            : <span className="text-zinc-300">Pilih operator dulu</span>
                                                        }
                                                    </div>
                                                    {matchedEmp && salaryFromEmp > 0 && (
                                                        <p className="text-[9px] text-emerald-600 font-bold mt-1">
                                                            Dari data karyawan ({matchedEmp.name})
                                                        </p>
                                                    )}
                                                    {!matchedEmp && currentSalary > 0 && (
                                                        <p className="text-[9px] text-zinc-400 font-bold mt-1">
                                                            Atur gaji di modul HCM → Master Karyawan
                                                        </p>
                                                    )}
                                                </>
                                            )
                                        })()}
                                        {durationMin > 0 && Number(step.laborMonthlySalary || 0) > 0 && (
                                            <div className="mt-2 space-y-1 bg-emerald-50 border border-emerald-200 p-2">
                                                <div className="flex justify-between text-[9px]">
                                                    <span className="text-zinc-400 font-bold">Jam/pcs</span>
                                                    <span className="font-mono font-bold">{hoursPerPcs.toFixed(2)} jam</span>
                                                </div>
                                                <div className="flex justify-between text-[9px]">
                                                    <span className="text-zinc-400 font-bold">Kapasitas/bulan</span>
                                                    <span className="font-mono font-bold">{Math.floor(pcsPerMonth).toLocaleString("id-ID")} pcs</span>
                                                </div>
                                                <div className="flex justify-between text-[9px] border-t border-emerald-200 pt-1 mt-1">
                                                    <span className="text-zinc-600 font-black">Biaya TK/pcs</span>
                                                    <span className="font-black text-emerald-700">{formatCurrency(laborCostPerPcs)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Catatan */}
                                <div>
                                    <FieldLabel icon={<FileText className="h-3 w-3" />}>Catatan</FieldLabel>
                                    <Textarea
                                        value={step.notes || ""}
                                        onChange={(e) => onUpdateStep("notes", e.target.value)}
                                        className="text-xs border-zinc-200 rounded-none min-h-[32px] h-8 placeholder:text-zinc-300"
                                        placeholder="Tulis catatan..."
                                    />
                                </div>
                            </div>
                        </SectionCard>
                    </div>

                    {/* RIGHT: Subkon/Allocation + Attachments */}
                    <div className="flex-1 space-y-3 min-w-0">
                        {/* Subkon selector or In-House allocator */}
                        {isSubkon ? (
                            <SectionCard
                                title="Subkontraktor"
                                icon={<Truck className="h-3 w-3 text-amber-500" />}
                                accent="border-amber-400"
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
                                icon={<GitBranch className="h-3 w-3 text-emerald-500" />}
                                accent="border-emerald-400"
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
                                        className="mt-2 text-[9px] font-bold text-zinc-400 hover:text-red-500"
                                    >
                                        Batalkan distribusi
                                    </button>
                                )}
                            </SectionCard>
                        ) : (
                            <button
                                onClick={() => setShowInhouseAlloc(true)}
                                className="w-full flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-zinc-300 text-[10px] font-bold text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                            >
                                <GitBranch className="h-3 w-3" /> Distribusi ke multi work center
                            </button>
                        )}

                        {/* Attachments */}
                        <SectionCard
                            title="Lampiran"
                            icon={<Paperclip className="h-3 w-3 text-blue-500" />}
                            accent="border-blue-400"
                        >
                            <div className="space-y-1.5">
                                {(step.attachments || []).map((att: any) => (
                                    <div key={att.id} className="flex items-center gap-2 text-xs group">
                                        <Paperclip className="h-3 w-3 text-zinc-400 shrink-0" />
                                        <a href={att.fileUrl} target="_blank" rel="noreferrer" className="font-bold truncate flex-1 hover:underline">{att.fileName}</a>
                                        <span className="text-[9px] text-zinc-400">{(att.fileSize / 1024).toFixed(0)}KB</span>
                                        <button onClick={() => onDeleteAttachment(att.id)} className="opacity-0 group-hover:opacity-100">
                                            <X className="h-3 w-3 text-zinc-400 hover:text-red-500" />
                                        </button>
                                    </div>
                                ))}
                                {(step.attachments || []).length === 0 && (
                                    <p className="text-[10px] text-zinc-300 font-bold text-center py-1">Belum ada lampiran</p>
                                )}
                            </div>
                            <Button onClick={onUploadAttachment} variant="outline" size="sm" className="h-7 text-[10px] font-bold rounded-none border-dashed w-full mt-2">
                                <Upload className="mr-1 h-3 w-3" /> Upload File
                            </Button>
                        </SectionCard>
                    </div>
                </div>

                {/* ROW 2: Production + Material Costs */}
                <div className="grid grid-cols-[240px_1fr] gap-3">
                    {/* Production tracking */}
                    <SectionCard
                        title="Produksi"
                        icon={<CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                        accent="border-emerald-400"
                    >
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    min={0}
                                    max={totalQty}
                                    value={completedQty || ""}
                                    onChange={(e) => onUpdateStep("completedQty", e.target.value ? parseInt(e.target.value) : 0)}
                                    className="h-8 text-xs font-mono border-zinc-200 rounded-none flex-1 placeholder:text-zinc-300"
                                    placeholder="0"
                                />
                                <span className="text-[10px] font-bold text-zinc-400 whitespace-nowrap">/ {totalQty} pcs</span>
                            </div>
                            {totalQty > 0 && (
                                <div>
                                    <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${
                                                progressPct >= 100 ? "bg-emerald-500" : progressPct > 0 ? "bg-amber-400" : "bg-zinc-200"
                                            }`}
                                            style={{ width: `${progressPct}%` }}
                                        />
                                    </div>
                                    <p className="text-[9px] font-bold text-zinc-400 mt-0.5 text-right">
                                        {progressPct.toFixed(0)}% selesai
                                    </p>
                                </div>
                            )}
                        </div>
                    </SectionCard>

                    {/* Material cost breakdown — ALWAYS visible */}
                    <SectionCard
                        title="Biaya Material"
                        icon={<BarChart3 className="h-3 w-3 text-emerald-500" />}
                        accent="border-emerald-400"
                    >
                        {stepMaterials.length === 0 ? (
                            <p className="text-xs text-zinc-300 font-bold py-2 text-center">Belum ada material di proses ini</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-zinc-200">
                                            <th className="text-left text-[9px] font-black uppercase text-zinc-400 pb-1 pr-3">Material</th>
                                            <th className="text-right text-[9px] font-black uppercase text-zinc-400 pb-1 px-2">Qty/Unit</th>
                                            <th className="text-right text-[9px] font-black uppercase text-zinc-400 pb-1 px-2">Harga</th>
                                            <th className="text-right text-[9px] font-black uppercase text-zinc-400 pb-1 px-2">&times; {totalQty}</th>
                                            <th className="text-right text-[9px] font-black uppercase text-zinc-400 pb-1 pl-2">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stepMaterials.map((sm: any) => {
                                            const item = sm.item as BOMItemWithCost
                                            const costPerUnit = calcItemCostPerUnit(item)
                                            const subtotal = costPerUnit * totalQty
                                            return (
                                                <tr key={sm.bomItemId} className="border-b border-zinc-50">
                                                    <td className="py-1 pr-3 font-bold truncate max-w-[160px]">{item.material?.name || "-"}</td>
                                                    <td className="py-1 px-2 text-right font-mono text-zinc-600">
                                                        {Number(item.quantityPerUnit || 0)} {item.unit || item.material?.unit || ""}
                                                    </td>
                                                    <td className="py-1 px-2 text-right font-mono text-zinc-600">{formatCurrency(Number(item.material?.costPrice || 0))}</td>
                                                    <td className="py-1 px-2 text-right font-mono text-zinc-600">{(Number(item.quantityPerUnit || 0) * totalQty).toLocaleString("id-ID")}</td>
                                                    <td className="py-1 pl-2 text-right font-bold">{formatCurrency(subtotal)}</td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t border-zinc-200">
                                            <td colSpan={4} className="py-1.5 text-right text-[9px] font-black uppercase text-zinc-400 pr-2">Total Material</td>
                                            <td className="py-1.5 text-right font-bold">{formatCurrency(stepMaterialTotal)}</td>
                                        </tr>
                                        {stepLaborTotal > 0 && (
                                            <tr>
                                                <td colSpan={4} className="py-1 text-right text-[9px] font-black uppercase text-zinc-400 pr-2">
                                                    Labor/Proses
                                                    {laborCostPerPcs > 0 && <span className="text-zinc-300 ml-1">({formatCurrency(laborCostPerPcs)}/pcs)</span>}
                                                </td>
                                                <td className="py-1 text-right font-bold">{formatCurrency(stepLaborTotal)}</td>
                                            </tr>
                                        )}
                                        <tr className="border-t-2 border-black">
                                            <td colSpan={4} className="py-1.5 text-right text-[10px] font-black uppercase pr-2">Total Proses</td>
                                            <td className="py-1.5 text-right font-black text-emerald-700">{formatCurrency(stepMaterialTotal + stepLaborTotal)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </SectionCard>
                </div>

                {/* ROW 3: Time Study — collapsible */}
                <SectionCard
                    title="Time Study"
                    icon={<Timer className="h-3 w-3 text-blue-500" />}
                    accent="border-blue-400"
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
                                className="h-8 text-xs font-mono border-zinc-200 rounded-none placeholder:text-zinc-300"
                                placeholder="2.5"
                            />
                            {Number(step.estimatedTimePerUnit || 0) > 0 && durationMin > 0 && (
                                <div className="mt-2 space-y-1 bg-blue-50 border border-blue-200 p-2">
                                    <div className="flex justify-between text-[9px]">
                                        <span className="text-zinc-400 font-bold">PCC (Durasi /pcs)</span>
                                        <span className="font-mono font-bold">{durationMin} menit</span>
                                    </div>
                                    <div className="flex justify-between text-[9px]">
                                        <span className="text-zinc-400 font-bold">Time Study</span>
                                        <span className="font-mono font-bold">{Number(step.estimatedTimePerUnit)} menit</span>
                                    </div>
                                    <div className="flex justify-between text-[9px] border-t border-blue-200 pt-1 mt-1">
                                        <span className="text-zinc-500 font-black">Selisih</span>
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
                                className="h-8 text-xs font-mono border-zinc-200 rounded-none placeholder:text-zinc-300"
                                placeholder="450"
                            />
                            {Number(step.actualTimeTotal || 0) > 0 && completedQty > 0 && (
                                <div className="mt-2 bg-blue-50 border border-blue-200 p-2">
                                    <div className="flex justify-between text-[9px]">
                                        <span className="text-zinc-400 font-bold">Rata-rata</span>
                                        <span className="font-mono font-bold">{(Number(step.actualTimeTotal) / completedQty).toFixed(2)} menit/pcs</span>
                                    </div>
                                    <div className="text-[9px] text-zinc-400 mt-0.5">
                                        Berdasarkan {completedQty} pcs selesai
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </SectionCard>
            </div>
        </div>
    )
}

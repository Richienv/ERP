"use client"

import { SubkonSelector } from "./subkon-selector"
import { calcItemCostPerUnit, calcStepMaterialCost, calcLaborCostPerPcs, WORKING_HOURS_PER_MONTH, type BOMItemWithCost } from "./bom-cost-helpers"
import { formatCurrency } from "@/lib/inventory-utils"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Paperclip, Upload, X, Clock, Cog, Building2, Truck, CheckCircle2 } from "lucide-react"

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
    if (!step) return null

    const isSubkon = step.useSubkon ?? step.station?.operationType === "SUBCONTRACTOR"

    // Get materials assigned to this step with cost data
    const stepMaterials = (step.materials || []).map((sm: any) => {
        const item = (allItems || []).find((i: any) => i.id === sm.bomItemId)
        return { ...sm, item }
    }).filter((sm: any) => sm.item)

    const stepMaterialTotal = calcStepMaterialCost(step, allItems || [], totalQty)
    const laborCostPerPcs = calcLaborCostPerPcs(step.laborMonthlySalary, step.durationMinutes)
    const stepLaborTotal = laborCostPerPcs > 0 ? laborCostPerPcs * totalQty : Number(step.station?.costPerUnit || 0) * totalQty

    // Labour calculation breakdown
    const durationMin = Number(step.durationMinutes || 0)
    const hoursPerPcs = durationMin > 0 ? durationMin / 60 : 0
    const pcsPerMonth = hoursPerPcs > 0 ? WORKING_HOURS_PER_MONTH / hoursPerPcs : 0

    // Filter stations of same type for the selector
    const sameTypeStations = (allStations || []).filter((s: any) =>
        s.stationType === step.station?.stationType &&
        s.operationType !== "SUBCONTRACTOR" &&
        s.isActive !== false
    )

    // Shared: Step config column
    const StepConfig = (
        <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
                <Cog className="h-4 w-4" />
                <h3 className="font-black text-sm uppercase">{step.station?.name}</h3>
            </div>

            {/* Station selector */}
            {sameTypeStations.length > 1 && onChangeStation && (
                <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Stasiun</label>
                    <Select
                        value={step.stationId || step.station?.id || ""}
                        onValueChange={(val) => {
                            const station = allStations?.find((s: any) => s.id === val)
                            if (station) onChangeStation(val, station)
                        }}
                    >
                        <SelectTrigger className="h-8 text-xs font-bold border-zinc-200 rounded-none">
                            <SelectValue placeholder="Pilih stasiun" />
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

            {/* In-House / Subkontrak toggle */}
            <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1.5 block">Tipe Operasi</label>
                <div className="flex gap-0">
                    <button
                        onClick={() => onToggleSubkon(false)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 border-2 border-black text-[10px] font-black uppercase transition-colors ${
                            !isSubkon
                                ? "bg-emerald-400 text-black"
                                : "bg-white text-zinc-400 hover:bg-zinc-50"
                        }`}
                    >
                        <Building2 className="h-3 w-3" /> In-House
                    </button>
                    <button
                        onClick={() => onToggleSubkon(true)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 border-2 border-l-0 border-black text-[10px] font-black uppercase transition-colors ${
                            isSubkon
                                ? "bg-amber-400 text-black"
                                : "bg-white text-zinc-400 hover:bg-zinc-50"
                        }`}
                    >
                        <Truck className="h-3 w-3" /> Subkon
                    </button>
                </div>
            </div>

            <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">
                    <Clock className="h-3 w-3 inline mr-1" /> Durasi /pcs (menit)
                </label>
                <Input
                    type="number"
                    min={0}
                    value={step.durationMinutes || ""}
                    onChange={(e) => {
                        const val = parseInt(e.target.value)
                        onUpdateStep("durationMinutes", isNaN(val) ? null : Math.max(0, val))
                    }}
                    className="h-8 text-xs font-mono border-zinc-200 rounded-none"
                />
            </div>
            {/* Labour Cost Calculator */}
            <div className="border-t border-zinc-100 pt-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">
                    Gaji Bulanan (Rp)
                </label>
                <Input
                    type="number"
                    min={0}
                    value={step.laborMonthlySalary || ""}
                    onChange={(e) => {
                        const val = parseFloat(e.target.value)
                        onUpdateStep("laborMonthlySalary", isNaN(val) ? null : Math.max(0, val))
                    }}
                    className="h-8 text-xs font-mono border-zinc-200 rounded-none"
                    placeholder="cth: 4000000"
                />
                {durationMin > 0 && Number(step.laborMonthlySalary || 0) > 0 && (
                    <div className="mt-1.5 space-y-0.5 bg-zinc-50 border border-zinc-200 p-2">
                        <div className="flex justify-between text-[9px]">
                            <span className="text-zinc-400 font-bold">Jam/pcs</span>
                            <span className="font-mono font-bold">{hoursPerPcs.toFixed(2)} jam</span>
                        </div>
                        <div className="flex justify-between text-[9px]">
                            <span className="text-zinc-400 font-bold">Kapasitas/bulan</span>
                            <span className="font-mono font-bold">{Math.floor(pcsPerMonth).toLocaleString("id-ID")} pcs</span>
                        </div>
                        <div className="flex justify-between text-[9px] border-t border-zinc-200 pt-1 mt-1">
                            <span className="text-zinc-500 font-black">Biaya TK/pcs</span>
                            <span className="font-black text-emerald-700">{formatCurrency(laborCostPerPcs)}</span>
                        </div>
                    </div>
                )}
            </div>

            <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Catatan</label>
                <Textarea
                    value={step.notes || ""}
                    onChange={(e) => onUpdateStep("notes", e.target.value)}
                    className="text-xs border-zinc-200 rounded-none min-h-[32px] h-8"
                />
            </div>

            {/* Completion tracking */}
            <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">
                    <CheckCircle2 className="h-3 w-3 inline mr-1" /> Selesai (pcs)
                </label>
                <div className="flex items-center gap-2">
                    <Input
                        type="number"
                        min={0}
                        max={totalQty}
                        value={step.completedQty ?? ""}
                        onChange={(e) => onUpdateStep("completedQty", e.target.value ? parseInt(e.target.value) : 0)}
                        className="h-8 text-xs font-mono border-zinc-200 rounded-none flex-1"
                        placeholder="0"
                    />
                    <span className="text-[10px] font-bold text-zinc-400 whitespace-nowrap">/ {totalQty} pcs</span>
                </div>
            </div>
        </div>
    )

    // Shared: Material cost breakdown
    const MaterialCostBreakdown = (
        <div className="min-w-0">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Rincian Biaya Material</h4>
            {stepMaterials.length === 0 ? (
                <p className="text-xs text-zinc-300 font-bold py-4 text-center">Belum ada material di proses ini</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-zinc-200">
                                <th className="text-left text-[9px] font-black uppercase text-zinc-400 pb-1 pr-3">Material</th>
                                <th className="text-right text-[9px] font-black uppercase text-zinc-400 pb-1 px-2">Qty/Unit</th>
                                <th className="text-right text-[9px] font-black uppercase text-zinc-400 pb-1 px-2">Harga</th>
                                <th className="text-right text-[9px] font-black uppercase text-zinc-400 pb-1 px-2">&times; {totalQty} pcs</th>
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
        </div>
    )

    // Shared: Attachments
    const Attachments = (
        <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                <Paperclip className="h-3 w-3 inline mr-1" /> Lampiran
            </h4>
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
            </div>
            <Button onClick={onUploadAttachment} variant="outline" size="sm" className="h-7 text-[10px] font-bold rounded-none border-dashed w-full mt-2">
                <Upload className="mr-1 h-3 w-3" /> Upload File
            </Button>
        </div>
    )

    // ── SUBKON LAYOUT: Config + SubkonSelector + Attachments ──
    if (isSubkon) {
        return (
            <div className="border-t-2 border-black bg-white px-4 lg:px-6 py-3 shrink-0 max-h-[420px] overflow-y-auto">
                <div className="flex items-start gap-4 lg:gap-6">
                    <div className="w-[220px] lg:w-[240px] shrink-0">
                        {StepConfig}
                    </div>
                    <div className="flex-1 border-l-2 border-amber-200 pl-4 lg:pl-6 bg-amber-50/30 -ml-0 py-2 px-4 border-2 border-amber-300">
                        <SubkonSelector
                            stationType={step.station?.stationType}
                            allocations={step.allocations || []}
                            totalQty={totalQty}
                            onChange={onUpdateAllocations}
                        />
                    </div>
                    <div className="w-[180px] shrink-0 border-l-2 border-zinc-100 pl-4">
                        {Attachments}
                    </div>
                </div>
            </div>
        )
    }

    // ── IN-HOUSE LAYOUT: 2 columns (original but simplified) ──
    return (
        <div className="border-t-2 border-black bg-white px-4 lg:px-6 py-3 shrink-0 max-h-[420px] overflow-y-auto">
            <div className="flex items-start gap-4 lg:gap-6">
                {/* LEFT — Step Config */}
                <div className="w-[220px] lg:w-[240px] shrink-0">
                    {StepConfig}
                </div>

                {/* CENTER — Material Cost Breakdown */}
                <div className="flex-1 border-l-2 border-zinc-100 pl-4 lg:pl-6">
                    {MaterialCostBreakdown}
                </div>

                {/* RIGHT — Attachments only (no subkon) */}
                <div className="w-[180px] shrink-0 border-l-2 border-zinc-100 pl-4">
                    {Attachments}
                </div>
            </div>
        </div>
    )
}

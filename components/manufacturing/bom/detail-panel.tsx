"use client"

import { SubkonSelector } from "./subkon-selector"
import { calcItemCostPerUnit, calcStepMaterialCost, type BOMItemWithCost } from "./bom-cost-helpers"
import { formatCurrency } from "@/lib/inventory-utils"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Paperclip, Upload, X, Clock, Cog, Building2, Truck } from "lucide-react"

interface DetailPanelProps {
    step: any
    totalQty: number
    allItems: any[]
    onUpdateStep: (field: string, value: any) => void
    onUpdateAllocations: (allocations: any[]) => void
    onUploadAttachment: () => void
    onDeleteAttachment: (id: string) => void
    onToggleSubkon: (useSubkon: boolean) => void
}

export function DetailPanel({
    step, totalQty, allItems,
    onUpdateStep, onUpdateAllocations,
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
    const stepLaborTotal = Number(step.station?.costPerUnit || 0) * totalQty

    return (
        <div className="border-t-2 border-black bg-white px-4 lg:px-6 py-3 shrink-0 max-h-[320px] overflow-auto">
            <div className="flex items-start gap-4 lg:gap-6 min-w-[700px]">
                {/* LEFT — Step Config */}
                <div className="w-[200px] lg:w-[240px] space-y-3 shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                        <Cog className="h-4 w-4" />
                        <h3 className="font-black text-sm uppercase">{step.station?.name}</h3>
                    </div>

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
                            <Clock className="h-3 w-3 inline mr-1" /> Durasi (menit)
                        </label>
                        <Input
                            type="number"
                            value={step.durationMinutes || ""}
                            onChange={(e) => onUpdateStep("durationMinutes", parseInt(e.target.value) || null)}
                            className="h-8 text-xs font-mono border-zinc-200 rounded-none"
                        />
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Catatan</label>
                        <Textarea
                            value={step.notes || ""}
                            onChange={(e) => onUpdateStep("notes", e.target.value)}
                            className="text-xs border-zinc-200 rounded-none min-h-[32px] h-8"
                        />
                    </div>
                </div>

                {/* CENTER — Material Cost Breakdown (flex-1) */}
                <div className="flex-1 border-l-2 border-zinc-100 pl-4 lg:pl-6 min-w-0">
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
                                            <td colSpan={4} className="py-1 text-right text-[9px] font-black uppercase text-zinc-400 pr-2">Labor/Proses</td>
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

                {/* RIGHT — Allocations + Attachments */}
                <div className="w-[220px] lg:w-[280px] border-l-2 border-zinc-100 pl-4 lg:pl-6 shrink-0 space-y-4">
                    {/* Allocations (subkon only) */}
                    {isSubkon && (
                        <SubkonSelector
                            stationType={step.station?.stationType}
                            allocations={step.allocations || []}
                            totalQty={totalQty}
                            onChange={onUpdateAllocations}
                        />
                    )}

                    {/* Attachments */}
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
                </div>
            </div>
        </div>
    )
}

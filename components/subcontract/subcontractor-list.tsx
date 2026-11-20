"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Factory, Plus, Phone, Mail, User, Pencil, DollarSign } from "lucide-react"
import type { SubcontractorSummary } from "@/lib/actions/subcontract"
import { CreateSubcontractorDialog } from "./create-subcontractor-dialog"
import { EditSubcontractorDialog } from "./edit-subcontractor-dialog"
import { RateManagementDialog } from "./rate-management-dialog"

const CAPABILITY_LABELS: Record<string, string> = {
    CUT: "Potong",
    SEW: "Jahit",
    WASH: "Cuci",
    PRINT: "Cetak",
    EMBROIDERY: "Bordir",
    FINISHING: "Finishing",
}

const CAPABILITY_COLORS: Record<string, string> = {
    CUT: "bg-amber-100 text-amber-700 border-amber-300",
    SEW: "bg-blue-100 text-blue-700 border-blue-300",
    WASH: "bg-cyan-100 text-cyan-700 border-cyan-300",
    PRINT: "bg-purple-100 text-purple-700 border-purple-300",
    EMBROIDERY: "bg-pink-100 text-pink-700 border-pink-300",
    FINISHING: "bg-emerald-100 text-emerald-700 border-emerald-300",
}

interface SubcontractorListProps {
    subcontractors: SubcontractorSummary[]
}

export function SubcontractorList({ subcontractors }: SubcontractorListProps) {
    const router = useRouter()
    const [showCreate, setShowCreate] = useState(false)
    const [editTarget, setEditTarget] = useState<SubcontractorSummary | null>(null)
    const [rateTarget, setRateTarget] = useState<SubcontractorSummary | null>(null)

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Factory className="h-5 w-5" />
                    <h2 className="text-sm font-semibold  ">
                        Registri Subkontraktor
                    </h2>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-zinc-100 border border-border">
                        {subcontractors.length}
                    </span>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-1.5 bg-slate-900 text-white border border-border shadow-sm hover:shadow-sm transition-all font-semibold text-xs px-4 h-8 rounded-md"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Tambah CMT
                </button>
            </div>

            {subcontractors.length === 0 ? (
                <div className="bg-white border border-border p-8 text-center">
                    <Factory className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                    <span className="text-xs font-semibold text-zinc-400">
                        Belum ada subkontraktor terdaftar
                    </span>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {subcontractors.map((sub) => (
                        <div
                            key={sub.id}
                            className={`bg-white border border-border shadow-sm cursor-pointer  hover:shadow-sm transition-all ${
                                !sub.isActive ? "opacity-50" : ""
                            }`}
                            onClick={() => router.push(`/subcontract/registry/${sub.id}`)}
                        >
                            {/* Header */}
                            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                                <span className="text-xs font-semibold">{sub.name}</span>
                                <div className="flex items-center gap-1">
                                    {!sub.isActive && (
                                        <span className="text-xs font-semibold px-1.5 py-0.5 bg-red-100 text-red-600 border border-red-300">
                                            NONAKTIF
                                        </span>
                                    )}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setRateTarget(sub)
                                        }}
                                        className="p-1 hover:bg-zinc-100 rounded-md"
                                        title="Kelola Tarif"
                                    >
                                        <DollarSign className="h-3.5 w-3.5 text-zinc-500" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setEditTarget(sub)
                                        }}
                                        className="p-1 hover:bg-zinc-100 rounded-md"
                                        title="Edit"
                                    >
                                        <Pencil className="h-3.5 w-3.5 text-zinc-500" />
                                    </button>
                                </div>
                            </div>

                            {/* Capabilities */}
                            <div className="px-4 py-2 border-b border-zinc-200">
                                <div className="flex flex-wrap gap-1">
                                    {sub.capabilities.map((cap) => (
                                        <span
                                            key={cap}
                                            className={`text-xs font-semibold px-1.5 py-0.5 border ${
                                                CAPABILITY_COLORS[cap] ||
                                                "bg-zinc-100 text-zinc-600 border-zinc-300"
                                            }`}
                                        >
                                            {CAPABILITY_LABELS[cap] || cap}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Contact info */}
                            <div className="px-4 py-2 space-y-1">
                                {sub.contactPerson && (
                                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                        <User className="h-3 w-3" />
                                        <span className="font-bold">{sub.contactPerson}</span>
                                    </div>
                                )}
                                {sub.phone && (
                                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                        <Phone className="h-3 w-3" />
                                        <span className="font-bold">{sub.phone}</span>
                                    </div>
                                )}
                                {sub.email && (
                                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                        <Mail className="h-3 w-3" />
                                        <span className="font-bold">{sub.email}</span>
                                    </div>
                                )}
                            </div>

                            {/* Stats */}
                            <div className="px-4 py-2 border-t border-zinc-200 flex items-center gap-4">
                                <div className="text-center">
                                    <div className="text-sm font-semibold">
                                        {sub.activeOrderCount}
                                    </div>
                                    <div className="text-xs font-bold text-zinc-400 ">
                                        Order Aktif
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="text-sm font-semibold">{sub.rateCount}</div>
                                    <div className="text-xs font-bold text-zinc-400 ">
                                        Tarif
                                    </div>
                                </div>
                                {sub.capacityUnitsPerDay && (
                                    <div className="text-center">
                                        <div className="text-sm font-semibold">
                                            {sub.capacityUnitsPerDay}
                                        </div>
                                        <div className="text-xs font-bold text-zinc-400 ">
                                            Unit/Hari
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <CreateSubcontractorDialog
                open={showCreate}
                onOpenChange={setShowCreate}
            />

            {editTarget && (
                <EditSubcontractorDialog
                    open={!!editTarget}
                    onOpenChange={(open) => {
                        if (!open) setEditTarget(null)
                    }}
                    subcontractor={editTarget}
                />
            )}

            {rateTarget && (
                <RateManagementDialog
                    open={!!rateTarget}
                    onOpenChange={(open) => {
                        if (!open) setRateTarget(null)
                    }}
                    subcontractorId={rateTarget.id}
                    subcontractorName={rateTarget.name}
                />
            )}
        </div>
    )
}

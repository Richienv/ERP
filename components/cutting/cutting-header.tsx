"use client"

import { useState } from "react"
import { Plus, Scissors } from "lucide-react"
import { CutPlanForm } from "./cut-plan-form"

interface CuttingHeaderProps {
    title: string
    fabricProducts: { id: string; name: string; code: string }[]
    /** Extra content (e.g. count badge) placed after title */
    children?: React.ReactNode
}

export function CuttingHeader({ title, fabricProducts, children }: CuttingHeaderProps) {
    const [formOpen, setFormOpen] = useState(false)

    return (
        <>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Scissors className="h-5 w-5" />
                    <h1 className="text-sm font-semibold  ">{title}</h1>
                    {children}
                </div>
                <button
                    onClick={() => setFormOpen(true)}
                    className="flex items-center gap-2 bg-slate-900 text-white border border-border shadow-sm hover:shadow-sm transition-all font-semibold text-xs px-4 py-2"
                >
                    <Plus className="h-4 w-4" /> Buat Cut Plan
                </button>
            </div>

            <CutPlanForm
                open={formOpen}
                onOpenChange={setFormOpen}
                fabricProducts={fabricProducts}
            />
        </>
    )
}

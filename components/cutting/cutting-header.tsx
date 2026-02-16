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
                    <h1 className="text-sm font-black uppercase tracking-widest">{title}</h1>
                    {children}
                </div>
                <button
                    onClick={() => setFormOpen(true)}
                    className="flex items-center gap-2 bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider px-4 py-2"
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

"use client"

import { ReactNode } from "react"

interface InventoryDashboardViewProps {
    headerSlot: ReactNode
    pulseBarSlot: ReactNode
    mainLeftSlot: ReactNode
    mainRightSlot: ReactNode
    bottomLeftSlot: ReactNode
    bottomRightSlot: ReactNode
}

export function InventoryDashboardView({
    headerSlot,
    pulseBarSlot,
    mainLeftSlot,
    mainRightSlot,
    bottomLeftSlot,
    bottomRightSlot,
}: InventoryDashboardViewProps) {
    return (
        <div className="w-full bg-zinc-50 dark:bg-slate-900 font-sans min-h-[calc(100svh-theme(spacing.16))]">
            <div className="flex flex-col gap-2 p-3 md:p-4 min-h-[calc(100svh-theme(spacing.16))]">

                {/* Row 1: Header — standalone */}
                <div className="flex-none">
                    {headerSlot}
                </div>

                {/* UNIFIED CONTAINER — PulseBar + Main + Bottom as one connected box */}
                <div className="flex-1 flex flex-col min-h-0 border border-border shadow-sm bg-white dark:bg-zinc-900 overflow-hidden">
                    {/* Row A: KPI PulseBar — top strip */}
                    <div className="flex-none border-b border-border">
                        {pulseBarSlot}
                    </div>

                    {/* Row B: Main Content Grid — takes remaining space */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0">
                        {/* Material Table — Primary workspace */}
                        <div className="md:col-span-9 min-h-0 overflow-auto border-b md:border-b-0 md:border-r border-border">
                            {mainLeftSlot}
                        </div>
                        {/* Warehouse Cards — Sidebar */}
                        <div className="md:col-span-3 min-h-0 overflow-auto">
                            {mainRightSlot}
                        </div>
                    </div>

                    {/* Row C: Bottom Strip — fixed at bottom */}
                    <div className="flex-none grid grid-cols-1 md:grid-cols-12 border-t border-border">
                        <div className="md:col-span-6 border-b md:border-b-0 md:border-r border-border">
                            {bottomLeftSlot}
                        </div>
                        <div className="md:col-span-6">
                            {bottomRightSlot}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}

"use client"

import { ReactNode } from "react"
import { motion } from "framer-motion"

interface InventoryDashboardViewProps {
    headerSlot: ReactNode
    pulseBarSlot: ReactNode
    mainLeftSlot: ReactNode
    mainRightSlot: ReactNode
    bottomLeftSlot: ReactNode
    bottomRightSlot: ReactNode
}

const fadeIn = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
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
        <div className="w-full bg-zinc-50 dark:bg-black font-sans min-h-[calc(100svh-theme(spacing.16))]">
            <div className="flex flex-col gap-2 p-3 md:p-4 h-[calc(100svh-theme(spacing.16))]">

                {/* Row 1: Header — standalone */}
                <motion.div
                    className="flex-none"
                    {...fadeIn}
                    transition={{ duration: 0.3 }}
                >
                    {headerSlot}
                </motion.div>

                {/* UNIFIED CONTAINER — PulseBar + Main + Bottom as one connected box */}
                <motion.div
                    className="flex-1 flex flex-col min-h-0 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden"
                    {...fadeIn}
                    transition={{ duration: 0.3, delay: 0.05 }}
                >
                    {/* Row A: KPI PulseBar — top strip */}
                    <div className="flex-none border-b-2 border-black">
                        {pulseBarSlot}
                    </div>

                    {/* Row B: Main Content Grid — takes remaining space */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0">
                        {/* Material Table — Primary workspace */}
                        <div className="md:col-span-9 min-h-0 overflow-auto border-b-2 md:border-b-0 md:border-r-2 border-black">
                            {mainLeftSlot}
                        </div>
                        {/* Warehouse Cards — Sidebar */}
                        <div className="md:col-span-3 min-h-0 overflow-auto">
                            {mainRightSlot}
                        </div>
                    </div>

                    {/* Row C: Bottom Strip — fixed at bottom */}
                    <div className="flex-none grid grid-cols-1 md:grid-cols-12 border-t-2 border-black">
                        <div className="md:col-span-6 border-b-2 md:border-b-0 md:border-r-2 border-black">
                            {bottomLeftSlot}
                        </div>
                        <div className="md:col-span-6">
                            {bottomRightSlot}
                        </div>
                    </div>
                </motion.div>

            </div>
        </div>
    )
}

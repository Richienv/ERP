"use client"

import { ReactNode } from "react"
import { motion } from "framer-motion"

interface DashboardViewProps {
    pulseBarSlot: ReactNode
    kpiCardsSlot: ReactNode
    actionCenterSlot: ReactNode
    financialHealthSlot: ReactNode
    warehouseSlot: ReactNode
    staffSlot: ReactNode
    activityFeedSlot: ReactNode
}

const fadeIn = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
}

export function DashboardView({
    pulseBarSlot,
    kpiCardsSlot,
    actionCenterSlot,
    financialHealthSlot,
    warehouseSlot,
    staffSlot,
    activityFeedSlot,
}: DashboardViewProps) {
    return (
        <div className="w-full bg-zinc-50 dark:bg-black font-sans min-h-[calc(100svh-theme(spacing.16))]">
            <div className="flex flex-col gap-4 p-4 md:p-5 lg:p-6 min-h-[calc(100svh-theme(spacing.16))]">

                {/* Row 1: Company Pulse Bar */}
                <motion.div
                    className="flex-none"
                    {...fadeIn}
                    transition={{ duration: 0.3 }}
                >
                    {pulseBarSlot}
                </motion.div>

                {/* Row 2: KPI Summary Cards */}
                <motion.div
                    className="flex-none"
                    {...fadeIn}
                    transition={{ duration: 0.3, delay: 0.05 }}
                >
                    {kpiCardsSlot}
                </motion.div>

                {/* Row 3: Action Center + Financial Health */}
                <motion.div
                    className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 min-h-0"
                    {...fadeIn}
                    transition={{ duration: 0.3, delay: 0.08 }}
                >
                    <div className="md:col-span-5 min-h-0 overflow-hidden">
                        {actionCenterSlot}
                    </div>
                    <div className="md:col-span-7 min-h-0 overflow-hidden">
                        {financialHealthSlot}
                    </div>
                </motion.div>

                {/* Row 4: Warehouse Overview */}
                <motion.div
                    className="flex-none"
                    {...fadeIn}
                    transition={{ duration: 0.3, delay: 0.1 }}
                >
                    {warehouseSlot}
                </motion.div>

                {/* Row 5: Staff Today */}
                <motion.div
                    className="flex-none"
                    {...fadeIn}
                    transition={{ duration: 0.3, delay: 0.12 }}
                >
                    {staffSlot}
                </motion.div>

                {/* Row 6: Activity Feed */}
                <motion.div
                    className="flex-none"
                    {...fadeIn}
                    transition={{ duration: 0.3, delay: 0.15 }}
                >
                    {activityFeedSlot}
                </motion.div>

            </div>
        </div>
    )
}

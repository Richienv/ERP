"use client"

import { ReactNode } from "react"
import { motion } from "framer-motion"

interface DashboardViewProps {
    pulseBarSlot: ReactNode
    actionCenterSlot: ReactNode
    financialHealthSlot: ReactNode
    aiSearchSlot: ReactNode
    operationsStripSlot: ReactNode
    activityFeedSlot: ReactNode
    trendingSlot: ReactNode
}

const fadeIn = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
}

export function DashboardView({
    pulseBarSlot,
    actionCenterSlot,
    financialHealthSlot,
    aiSearchSlot,
    operationsStripSlot,
    activityFeedSlot,
    trendingSlot,
}: DashboardViewProps) {
    return (
        <div className="w-full bg-zinc-50 dark:bg-black font-sans min-h-[calc(100svh-theme(spacing.16))]">
            <div className="flex flex-col gap-4 p-4 md:p-5 lg:p-6 h-[calc(100svh-theme(spacing.16))]">

                {/* Row 1: Company Pulse Bar */}
                <motion.div
                    className="flex-none"
                    {...fadeIn}
                    transition={{ duration: 0.3 }}
                >
                    {pulseBarSlot}
                </motion.div>

                {/* Row 2: Middle Row — Action Center + Financial Health + AI Search */}
                <motion.div
                    className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 min-h-0"
                    {...fadeIn}
                    transition={{ duration: 0.3, delay: 0.05 }}
                >
                    {/* CEO Action Center */}
                    <div className="md:col-span-3 min-h-0 overflow-hidden">
                        {actionCenterSlot}
                    </div>
                    {/* Financial Health */}
                    <div className="md:col-span-5 min-h-0 overflow-hidden">
                        {financialHealthSlot}
                    </div>
                    {/* AI Search */}
                    <div className="md:col-span-4 min-h-0 overflow-hidden">
                        {aiSearchSlot}
                    </div>
                </motion.div>

                {/* Row 3: Operations Strip */}
                <motion.div
                    className="flex-none"
                    {...fadeIn}
                    transition={{ duration: 0.3, delay: 0.1 }}
                >
                    {operationsStripSlot}
                </motion.div>

                {/* Row 4: Bottom Row — Activity Feed + Trending */}
                <motion.div
                    className="flex-none grid grid-cols-1 md:grid-cols-12 gap-4"
                    style={{ height: "180px" }}
                    {...fadeIn}
                    transition={{ duration: 0.3, delay: 0.15 }}
                >
                    <div className="md:col-span-8 min-h-0 overflow-hidden">
                        {activityFeedSlot}
                    </div>
                    <div className="md:col-span-4 min-h-0 overflow-hidden">
                        {trendingSlot}
                    </div>
                </motion.div>

            </div>
        </div>
    )
}

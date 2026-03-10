"use client"

import { ReactNode } from "react"
import { motion } from "framer-motion"

interface DashboardViewProps {
    heroSlot: ReactNode
    alertSlot?: ReactNode
    gridSlot: ReactNode
}

export function DashboardView({ heroSlot, alertSlot, gridSlot }: DashboardViewProps) {
    return (
        <div className="mf-page !space-y-4">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                {heroSlot}
            </motion.div>
            {alertSlot && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 }}
                >
                    {alertSlot}
                </motion.div>
            )}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.1 }}
            >
                {gridSlot}
            </motion.div>
        </div>
    )
}

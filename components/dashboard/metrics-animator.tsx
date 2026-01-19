"use client"

import { motion } from "framer-motion"
import { ReactNode } from "react"

export function MetricsAnimator({ children }: { children: ReactNode }) {
    return (
        <motion.div
            className="contents" // "contents" allows children to sit in the parent grid
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
        >
            {children}
        </motion.div>
    )
}

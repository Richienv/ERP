"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { IconWifiOff } from "@tabler/icons-react"

export function OfflineIndicator() {
    const [isOffline, setIsOffline] = useState(false)

    useEffect(() => {
        const goOffline = () => setIsOffline(true)
        const goOnline = () => setIsOffline(false)

        setIsOffline(!navigator.onLine)

        window.addEventListener("offline", goOffline)
        window.addEventListener("online", goOnline)
        return () => {
            window.removeEventListener("offline", goOffline)
            window.removeEventListener("online", goOnline)
        }
    }, [])

    return (
        <AnimatePresence>
            {isOffline && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border-2 border-black bg-yellow-400 px-4 py-2.5 font-sans text-sm font-medium text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                    <IconWifiOff size={18} />
                    <span>Anda sedang offline. Perubahan akan disimpan saat koneksi kembali.</span>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

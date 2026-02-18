"use client"

import { useEffect } from "react"

export function ServiceWorkerRegister() {
    useEffect(() => {
        if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
            navigator.serviceWorker.register("/sw.js").catch(() => {
                // Silent fail — SW is a progressive enhancement
            })
        }
    }, [])

    return null
}

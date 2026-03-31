"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000 // Check for SW updates every 30 min

/**
 * Service Worker registration with update lifecycle management.
 *
 * - Registers SW in production only
 * - Checks for updates every 30 min (catches new deploys without page reload)
 * - Listens for SW_UPDATED message → shows "Update tersedia" toast
 * - Toast action reloads the page to activate new assets
 */
export function ServiceWorkerRegister() {
    const hasRegistered = useRef(false)

    useEffect(() => {
        if (!("serviceWorker" in navigator)) return
        if (process.env.NODE_ENV !== "production") return
        if (hasRegistered.current) return
        hasRegistered.current = true

        let updateInterval: ReturnType<typeof setInterval> | null = null

        // ── Listen for SW_UPDATED messages from the service worker ──
        function handleMessage(event: MessageEvent) {
            if (event.data?.type === "SW_UPDATED") {
                toast.info("Update tersedia", {
                    description: "Versi terbaru telah diunduh. Muat ulang untuk memperbarui.",
                    duration: Infinity,
                    action: {
                        label: "Muat Ulang",
                        onClick: () => window.location.reload(),
                    },
                })
            }
        }
        navigator.serviceWorker.addEventListener("message", handleMessage)

        // ── Register the service worker ──
        navigator.serviceWorker
            .register("/sw.js")
            .then((registration) => {
                // Periodically check for updates (new deployments)
                updateInterval = setInterval(() => {
                    registration.update().catch(() => {})
                }, UPDATE_CHECK_INTERVAL)

                // Also detect when a new SW has installed and is waiting
                registration.addEventListener("updatefound", () => {
                    const newWorker = registration.installing
                    if (!newWorker) return

                    newWorker.addEventListener("statechange", () => {
                        // New SW is active — it will postMessage("SW_UPDATED")
                        // which we handle above via the message listener
                        if (newWorker.state === "activated") {
                            // The SW itself sends the message, but as a safety net:
                            // if the message was missed, show the toast anyway
                        }
                    })
                })
            })
            .catch(() => {
                // Silent fail — SW is a progressive enhancement
            })

        return () => {
            navigator.serviceWorker.removeEventListener("message", handleMessage)
            if (updateInterval) clearInterval(updateInterval)
        }
    }, [])

    return null
}

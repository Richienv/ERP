"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { routePrefetchMap } from "@/hooks/use-nav-prefetch"
import { useAuth } from "@/lib/auth-context"
import {
    IconPackage, IconShoppingCart, IconTruck, IconCoin,
    IconBuildingFactory2, IconUsers, IconCheck, IconLoader2
} from "@tabler/icons-react"

/* ─── Route metadata for display ─────────────────────────────── */

type ModuleKey = "Inventori" | "Penjualan" | "Pengadaan" | "Keuangan" | "Manufaktur" | "SDM"

const MODULE_CONFIG: Record<ModuleKey, { icon: typeof IconPackage; color: string }> = {
    Inventori: { icon: IconPackage, color: "text-emerald-600" },
    Penjualan: { icon: IconShoppingCart, color: "text-blue-600" },
    Pengadaan: { icon: IconTruck, color: "text-orange-600" },
    Keuangan: { icon: IconCoin, color: "text-purple-600" },
    Manufaktur: { icon: IconBuildingFactory2, color: "text-red-600" },
    SDM: { icon: IconUsers, color: "text-teal-600" },
}

const ROUTE_META: Record<string, { label: string; module: ModuleKey }> = {
    "/inventory/products": { label: "Data Produk", module: "Inventori" },
    "/inventory/categories": { label: "Kategori", module: "Inventori" },
    "/inventory/fabric-rolls": { label: "Gulungan Kain", module: "Inventori" },
    "/inventory/transfers": { label: "Transfer Stok", module: "Inventori" },
    "/sales/customers": { label: "Pelanggan", module: "Penjualan" },
    "/sales/orders": { label: "Pesanan", module: "Penjualan" },
    "/sales/leads": { label: "Prospek", module: "Penjualan" },
    "/sales/quotations": { label: "Penawaran", module: "Penjualan" },
    "/sales/sales": { label: "Dashboard Penjualan", module: "Penjualan" },
    "/procurement/orders": { label: "Purchase Order", module: "Pengadaan" },
    "/procurement/requests": { label: "Permintaan Pembelian", module: "Pengadaan" },
    "/procurement/vendors": { label: "Vendor", module: "Pengadaan" },
    "/procurement/receiving": { label: "Penerimaan Barang", module: "Pengadaan" },
    "/finance": { label: "Dashboard Keuangan", module: "Keuangan" },
    "/finance/journal": { label: "Jurnal", module: "Keuangan" },
    "/finance/chart-accounts": { label: "Bagan Akun", module: "Keuangan" },
    "/finance/vendor-payments": { label: "Pembayaran Vendor", module: "Keuangan" },
    "/finance/bills": { label: "Tagihan", module: "Keuangan" },
    "/manufacturing": { label: "Dashboard Manufaktur", module: "Manufaktur" },
    "/manufacturing/bom": { label: "Bill of Materials", module: "Manufaktur" },
    "/manufacturing/orders": { label: "Manufacturing Order", module: "Manufaktur" },
    "/manufacturing/work-centers": { label: "Mesin & Work Center", module: "Manufaktur" },
    "/manufacturing/groups": { label: "Grup Mesin", module: "Manufaktur" },
    "/manufacturing/routing": { label: "Routing", module: "Manufaktur" },
    "/manufacturing/planning": { label: "Perencanaan", module: "Manufaktur" },
    "/manufacturing/work-orders": { label: "SPK", module: "Manufaktur" },
    "/manufacturing/schedule": { label: "Jadwal Produksi", module: "Manufaktur" },
    "/manufacturing/quality": { label: "Quality Control", module: "Manufaktur" },
    "/hcm/employee-master": { label: "Data Karyawan", module: "SDM" },
}

type RouteStatus = "pending" | "loading" | "done" | "error"

const SESSION_KEY = "erp_cache_warmed"

export function CacheWarmingOverlay() {
    const { isAuthenticated, isLoading: authLoading } = useAuth()
    const queryClient = useQueryClient()
    const [show, setShow] = useState(false)
    const [fadeOut, setFadeOut] = useState(false)
    const [routeStatuses, setRouteStatuses] = useState<Record<string, RouteStatus>>({})
    const hasStarted = useRef(false)

    // Check if cache is cold (no queries cached yet)
    const isCacheCold = useCallback(() => {
        const allRoutes = Object.keys(routePrefetchMap)
        const cachedCount = allRoutes.filter((route) => {
            const config = routePrefetchMap[route]
            return queryClient.getQueryData(config.queryKey) !== undefined
        }).length
        return cachedCount < allRoutes.length * 0.5 // cold if <50% cached
    }, [queryClient])

    useEffect(() => {
        if (authLoading || !isAuthenticated || hasStarted.current) return

        // Check sessionStorage — don't show overlay again in same session
        if (sessionStorage.getItem(SESSION_KEY) === "true") {
            // Still warm cache silently in background
            silentWarm()
            return
        }

        if (!isCacheCold()) {
            sessionStorage.setItem(SESSION_KEY, "true")
            silentWarm()
            return
        }

        hasStarted.current = true
        setShow(true)
        startVisualWarm()
    }, [authLoading, isAuthenticated]) // eslint-disable-line react-hooks/exhaustive-deps

    const silentWarm = useCallback(() => {
        Object.values(routePrefetchMap).forEach((config) => {
            queryClient.prefetchQuery({
                queryKey: config.queryKey,
                queryFn: config.queryFn,
            })
        })
    }, [queryClient])

    const startVisualWarm = useCallback(async () => {
        const routes = Object.keys(routePrefetchMap)

        // Initialize all as pending
        const initial: Record<string, RouteStatus> = {}
        routes.forEach((r) => { initial[r] = "pending" })
        setRouteStatuses(initial)

        // Fetch all in parallel, updating status individually
        const promises = routes.map(async (route) => {
            const config = routePrefetchMap[route]

            setRouteStatuses((prev) => ({ ...prev, [route]: "loading" }))

            try {
                await queryClient.prefetchQuery({
                    queryKey: config.queryKey,
                    queryFn: config.queryFn,
                })
                setRouteStatuses((prev) => ({ ...prev, [route]: "done" }))
            } catch {
                setRouteStatuses((prev) => ({ ...prev, [route]: "error" }))
            }
        })

        await Promise.allSettled(promises)

        // Mark session as warmed
        sessionStorage.setItem(SESSION_KEY, "true")

        // Auto-dismiss after a short delay
        setTimeout(() => {
            setFadeOut(true)
            setTimeout(() => setShow(false), 400)
        }, 600)
    }, [queryClient])

    if (!show) return null

    // Group routes by module
    const routes = Object.keys(routePrefetchMap)
    const totalCount = routes.length
    const doneCount = routes.filter((r) => routeStatuses[r] === "done" || routeStatuses[r] === "error").length
    const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

    const moduleGroups: Record<ModuleKey, { route: string; label: string; status: RouteStatus }[]> = {
        Inventori: [], Penjualan: [], Pengadaan: [], Keuangan: [], Manufaktur: [], SDM: [],
    }

    routes.forEach((route) => {
        const meta = ROUTE_META[route]
        if (meta) {
            moduleGroups[meta.module].push({
                route,
                label: meta.label,
                status: routeStatuses[route] || "pending",
            })
        }
    })

    return (
        <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm transition-opacity duration-400 ${fadeOut ? "opacity-0" : "opacity-100"}`}
        >
            <div className="w-full max-w-2xl mx-4">
                {/* Header */}
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold font-sans text-zinc-900 dark:text-zinc-100">
                        Mempersiapkan Sistem
                    </h2>
                    <p className="text-sm text-zinc-500 mt-1">
                        Mengunduh data agar semua halaman terbuka instan
                    </p>
                </div>

                {/* Progress bar */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            {doneCount} / {totalCount} halaman
                        </span>
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            {progressPct}%
                        </span>
                    </div>
                    <div className="h-3 bg-zinc-100 dark:bg-zinc-800 border-2 border-black overflow-hidden">
                        <div
                            className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                </div>

                {/* Module groups */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto pr-1">
                    {(Object.keys(moduleGroups) as ModuleKey[]).map((moduleName) => {
                        const items = moduleGroups[moduleName]
                        if (items.length === 0) return null
                        const moduleConf = MODULE_CONFIG[moduleName]
                        const ModIcon = moduleConf.icon
                        const moduleDone = items.filter((i) => i.status === "done" || i.status === "error").length

                        return (
                            <div
                                key={moduleName}
                                className="border-2 border-black bg-white dark:bg-zinc-900 p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <ModIcon size={16} className={moduleConf.color} />
                                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                                        {moduleName}
                                    </span>
                                    <span className="ml-auto text-[10px] font-mono text-zinc-500">
                                        {moduleDone}/{items.length}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    {items.map((item) => (
                                        <div key={item.route} className="flex items-center gap-1.5">
                                            <StatusIcon status={item.status} />
                                            <span className={`text-[11px] leading-tight ${
                                                item.status === "done"
                                                    ? "text-zinc-500 dark:text-zinc-500"
                                                    : "text-zinc-700 dark:text-zinc-300"
                                            }`}>
                                                {item.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

function StatusIcon({ status }: { status: RouteStatus }) {
    if (status === "done") {
        return <IconCheck size={12} className="text-emerald-500 shrink-0" />
    }
    if (status === "loading") {
        return <IconLoader2 size={12} className="text-blue-500 animate-spin shrink-0" />
    }
    if (status === "error") {
        return <IconCheck size={12} className="text-amber-500 shrink-0" />
    }
    // pending
    return <div className="w-3 h-3 rounded-full border border-zinc-300 dark:border-zinc-600 shrink-0" />
}

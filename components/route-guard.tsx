"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"

// Define accessible routes per role
const ROLE_PERMISSIONS = {
    "ROLE_CEO": ["*"], // Can access everything
    "ROLE_MANAGER": ["/dashboard", "/manufacturing", "/inventory", "/sales"], // Example: Manager access
    "ROLE_ACCOUNTANT": ["/accountant", "/finance", "/dashboard"], // Accountant specific + shared dashboard components if needed? Actually user wants STRICT.
    "ROLE_STAFF": ["/staff"] // Strict staff access
}

// Routes that don't require checking (public or auth related)
const PUBLIC_ROUTES = ["/login", "/auth", "/signup", "/forgot-password"]

export function RouteGuard({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated, isLoading } = useAuth()
    const pathname = usePathname()
    const router = useRouter()
    const [isAuthorized, setIsAuthorized] = useState(false)

    useEffect(() => {
        // 1. Always allow public routes immediately
        if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
            setIsAuthorized(true)
            return
        }

        // 2. While auth is still loading, DON'T redirect — just wait.
        //    This prevents redirect storms and infinite loading on server restart.
        if (isLoading) {
            return // Keep current isAuthorized state (false initially = blank screen, but brief)
        }

        // 3. Auth has finished loading. If not authenticated, redirect to login.
        if (!isAuthenticated || !user) {
            setIsAuthorized(false)
            router.push("/login")
            return
        }

        // 4. User is authenticated -> Check strict role permissions
        // CEO: Global Access
        if (user.role === "ROLE_CEO") {
            setIsAuthorized(true)
            return
        }

        // ADMIN/DIRECTOR: Global Access (server remains source of truth)
        if (user.role === "ROLE_ADMIN" || user.role === "ROLE_DIRECTOR") {
            setIsAuthorized(true)
            return
        }

        // PURCHASING: Procurement module
        if (user.role === "ROLE_PURCHASING") {
            if (
                pathname.startsWith("/procurement") ||
                pathname.startsWith("/inventory")
            ) {
                setIsAuthorized(true)
            } else {
                router.replace("/procurement")
                setIsAuthorized(false)
            }
            return
        }

        // WAREHOUSE: Receiving module
        if (user.role === "ROLE_WAREHOUSE") {
            if (
                pathname.startsWith("/procurement/receiving") ||
                pathname.startsWith("/inventory")
            ) {
                setIsAuthorized(true)
            } else {
                router.replace("/procurement/receiving")
                setIsAuthorized(false)
            }
            return
        }

        // STAFF: Strict /staff only
        if (user.role === "ROLE_STAFF") {
            if (pathname === "/staff" || pathname.startsWith("/staff/")) {
                setIsAuthorized(true)
            } else {
                router.replace("/staff")
                setIsAuthorized(false)
            }
            return
        }

        // ACCOUNTANT: Strict /accountant, optionally /finance
        if (user.role === "ROLE_ACCOUNTANT") {
            if (
                pathname === "/accountant" || pathname.startsWith("/accountant/") ||
                pathname === "/finance" || pathname.startsWith("/finance/")
            ) {
                setIsAuthorized(true)
            } else {
                router.replace("/accountant")
                setIsAuthorized(false)
            }
            return
        }

        // MANAGER: "God Mode" View + Operational areas
        // Block: Finance, Accountant, Staff (optional)
        if (user.role === "ROLE_MANAGER") {
            if (
                pathname.startsWith("/finance") ||
                pathname.startsWith("/accountant") ||
                pathname.startsWith("/staff")
            ) {
                router.replace(ROLE_PERMISSIONS["ROLE_MANAGER"][0] || "/dashboard")
                setIsAuthorized(false)
            } else {
                setIsAuthorized(true)
            }
            return
        }

        // SALES: Sales module
        if (user.role === "ROLE_SALES") {
            if (
                pathname.startsWith("/sales") ||
                pathname.startsWith("/dashboard")
            ) {
                setIsAuthorized(true)
            } else {
                router.replace("/sales")
                setIsAuthorized(false)
            }
            return
        }

        // Fallback for other roles or unhandled cases
        setIsAuthorized(true)

    }, [pathname, user, isAuthenticated, isLoading, router])

    // While auth is loading on non-public routes, show nothing briefly (not a redirect)
    if (isLoading && !PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
        return null
    }

    // Prevent flash of unauthorized content
    if (!isAuthorized) {
        return null
    }

    return <>{children}</>
}

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
    const { user, isAuthenticated } = useAuth()
    const pathname = usePathname()
    const router = useRouter()
    const [isAuthorized, setIsAuthorized] = useState(false)

    useEffect(() => {
        // 1. Always allow public routes
        if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
            setIsAuthorized(true)
            return
        }

        // 2. Wait for auth check
        if (!isAuthenticated) {
            // If we're not authenticated and it's not a public route, 
            // AuthContext typically handles this, but we hide content just in case.
            setIsAuthorized(false)
            // Optionally force redirect here if AuthContext is slow
            if (!user) router.push("/login")
            return
        }

        // 3. User is authenticated -> Check strict role permissions
        if (user) {
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
                    // Tried to access blocked page -> Bounce back to /staff
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

            // MANAGER: Operational areas (Manufacturing, Procurement, Inventory, Sales, Dashboard)
            // Block: Finance, Accountant, Staff (optional)
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

            // Fallback for other roles or unhandled cases
            setIsAuthorized(true)
        }

    }, [pathname, user, isAuthenticated, router])

    // Prevent flash of unauthorized content
    if (!isAuthorized) {
        return null
    }

    return <>{children}</>
}

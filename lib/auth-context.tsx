"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { type User } from "@supabase/supabase-js"

// Define the User Role (SystemRole)
export type UserRole =
    | "ROLE_CEO"
    | "ROLE_DIRECTOR"
    | "ROLE_MANAGER"
    | "ROLE_ACCOUNTANT"
    | "ROLE_ADMIN"
    | "ROLE_PURCHASING"
    | "ROLE_WAREHOUSE"
    | "ROLE_STAFF"
    | "ROLE_SALES"
    | "GUEST"

// Extended User type to include our metadata
export interface AppUser extends User {
    role?: UserRole
    name?: string
    avatar?: string
}

interface AuthContextType {
    user: AppUser | null
    isAuthenticated: boolean
    isLoading: boolean
    logout: () => Promise<void>
    homePath: string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Clear all Supabase auth artifacts from the browser.
 * Called when we detect a corrupt/stale session to prevent
 * the app from being stuck in an error loop.
 */
function clearSupabaseSession() {
    // Clear cookies (especially sb-* auth cookies)
    try {
        document.cookie.split(";").forEach((c) => {
            const name = c.trim().split("=")[0]
            if (name.startsWith("sb-") || name.includes("supabase")) {
                document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
            }
        })
    } catch {}

    // Clear Supabase keys from localStorage
    try {
        const keysToRemove: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && (key.startsWith("sb-") || key.includes("supabase"))) {
                keysToRemove.push(key)
            }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key))
    } catch {}

    // Clear sessionStorage
    try {
        const keysToRemove: string[] = []
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i)
            if (key && (key.startsWith("sb-") || key.includes("supabase"))) {
                keysToRemove.push(key)
            }
        }
        keysToRemove.forEach((key) => sessionStorage.removeItem(key))
    } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AppUser | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        // Check active session
        const checkSession = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession()

                if (error) {
                    console.warn("Session check returned error, clearing stale session:", error.message)
                    clearSupabaseSession()
                    setUser(null)
                    setIsLoading(false)
                    return
                }

                if (session?.user) {
                    await fetchUserProfile(session.user)
                } else {
                    setUser(null)
                }
            } catch (error) {
                // This catches network errors, JSON parse errors, and any other
                // unexpected failures when the auth state is corrupt
                console.error("Session check failed with exception, clearing stale session:", error)
                clearSupabaseSession()
                setUser(null)
            } finally {
                setIsLoading(false)
            }
        }

        checkSession()

        // Listen for auth changes
        let subscription: { unsubscribe: () => void } | null = null
        try {
            const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
                if (event === "SIGNED_OUT" || event === "TOKEN_REFRESHED" && !session) {
                    setUser(null)
                    setIsLoading(false)
                    return
                }

                if (session?.user) {
                    try {
                        await fetchUserProfile(session.user)
                    } catch (err) {
                        console.error("Failed to fetch user profile on auth change:", err)
                        setUser(null)
                        setIsLoading(false)
                    }
                } else {
                    setUser(null)
                    setIsLoading(false)
                }
            })
            subscription = data.subscription
        } catch (err) {
            console.error("Failed to subscribe to auth changes:", err)
            setIsLoading(false)
        }

        return () => {
            subscription?.unsubscribe()
        }
    }, [router])

    const fetchUserProfile = async (authUser: User) => {
        // In a real app, query "public.Employee" or "public.User" here.
        // For now, we will use metadata or fallback mechanism
        // We will default to ROLE_CEO for the first user or based on email logic if you prefer

        // TEMPORARY: If email is 'ceo@erp.com' -> CEO. Else -> STAFF
        // Long term: fetch tables

        // Mocking fetching role from DB based on auth ID
        let role: UserRole = "ROLE_STAFF" // Default

        // Check if metadata has role (if we set it during signup)
        if (authUser.user_metadata?.role) {
            role = authUser.user_metadata.role
        }

        // Construct AppUser
        const appUser: AppUser = {
            ...authUser,
            role: role,
            name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || "User",
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${authUser.email}`
        }

        setUser(appUser)
        setIsLoading(false)
    }

    const logout = async () => {
        try {
            await supabase.auth.signOut()
        } catch (err) {
            // Even if signOut fails (e.g., network error), clear local state
            console.warn("Sign out API call failed, clearing local session:", err)
            clearSupabaseSession()
        }
        setUser(null)
        router.push("/login")
        router.refresh()
    }

    // Determine Home Path based on Role
    const homePath = React.useMemo(() => {
        if (!user) return "/dashboard"
        switch (user.role) {
            case "ROLE_CEO": return "/dashboard"
            case "ROLE_DIRECTOR": return "/dashboard"
            case "ROLE_ADMIN": return "/dashboard"
            case "ROLE_MANAGER": return "/manager"
            case "ROLE_ACCOUNTANT": return "/finance" // or /accountant
            case "ROLE_PURCHASING": return "/procurement"
            case "ROLE_WAREHOUSE": return "/procurement/receiving"
            case "ROLE_STAFF": return "/staff"
            case "ROLE_SALES": return "/sales"
            default: return "/dashboard"
        }
    }, [user])

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, logout, homePath }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider")
    }
    return context
}

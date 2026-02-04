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

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AppUser | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        // Check active session
        const checkSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (session?.user) {
                    await fetchUserProfile(session.user)
                } else {
                    setUser(null)
                }
            } catch (error) {
                console.error("Session check failed", error)
            } finally {
                setIsLoading(false)
            }
        }

        checkSession()

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                await fetchUserProfile(session.user)
            } else {
                setUser(null)
                setIsLoading(false)
                // router.push("/login") // Don't force push here, let middleware handle it or individual pages
            }
        })

        return () => {
            subscription.unsubscribe()
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
        await supabase.auth.signOut()
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

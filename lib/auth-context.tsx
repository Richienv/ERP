"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { useRouter } from "next/navigation"

// Define the User Type based on our Roles
export type UserRole =
    | "ROLE_CEO"
    | "ROLE_MANAGER"
    | "ROLE_ACCOUNTANT"
    | "ROLE_STAFF"
    | "GUEST"

export interface User {
    username: string
    name: string
    role: UserRole
    avatar?: string
}

interface AuthContextType {
    user: User | null
    isAuthenticated: boolean
    login: (username: string, role: UserRole) => void
    logout: () => void
    homePath: string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const router = useRouter()

    // Load user from local storage on mount
    useEffect(() => {
        const storedUser = localStorage.getItem("erp_user")
        if (storedUser) {
            setUser(JSON.parse(storedUser))
        }
    }, [])

    const login = (username: string, role: UserRole) => {
        // Mock user data creation
        const newUser: User = {
            username,
            name: username, // For simplicity, use username as name or map it later
            role,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`
        }

        setUser(newUser)
        localStorage.setItem("erp_user", JSON.stringify(newUser))

        // Redirect logic based on role
        switch (role) {
            case "ROLE_CEO":
                router.push("/dashboard")
                break
            case "ROLE_MANAGER":
                router.push("/manager")
                break
            case "ROLE_ACCOUNTANT":
                router.push("/accountant")
                break
            case "ROLE_STAFF":
                router.push("/staff")
                break
            default:
                router.push("/dashboard")
        }
    }

    const logout = () => {
        setUser(null)
        localStorage.removeItem("erp_user")
        router.push("/login")
    }

    const getHomePath = (userRole?: UserRole) => {
        switch (userRole) {
            case "ROLE_STAFF":
                return "/staff"
            case "ROLE_ACCOUNTANT":
                return "/accountant"
            case "ROLE_MANAGER":
                return "/manager"
            case "ROLE_CEO":
            default:
                return "/dashboard"
        }
    }

    const homePath = getHomePath(user?.role)

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, homePath }}>
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

import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"

export type UserRole = "admin" | "user" | "manager" | "CEO" | "DIRECTOR" | "PURCHASING" | "WAREHOUSE"

// Map legacy simple roles to enterprise roles if needed, or just allow string matching
export async function getCurrentUserRole() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        return null
    }

    try {
        // 1. Try metadata first (fastest)
        const metadata = (user.user_metadata as any) || {}
        let role = metadata?.role || ""

        // 2. Fallback: Get from public.users table (authoritative)
        let dbId = user.id
        if (user.email) {
            const dbUser = await prisma.user.findUnique({
                where: { email: user.email },
                select: { role: true, id: true }
            })
            if (dbUser) {
                dbId = dbUser.id
                if (!role) role = dbUser.role
            }
        }

        if (!role) role = "ROLE_STAFF"

        return {
            id: user.id,
            dbId,
            email: user.email,
            role
        }
    } catch (e) {
        console.error("Error fetching user role:", e)
        return null
    }
}

export async function requireUser() {
    const user = await getCurrentUserRole()
    if (!user) {
        throw new Error("Unauthorized: User not authenticated")
    }
    return user
}

export async function requireRole(allowedRoles: string[]) {
    const user = await getCurrentUserRole()
    
    if (!user) {
        throw new Error("Unauthorized: Not authenticated")
    }

    const normalizedUserRole = user.role.toUpperCase()
    const hasRole = allowedRoles.some(role =>
        normalizedUserRole === role.toUpperCase()
    ) || normalizedUserRole === 'ADMIN' || normalizedUserRole === 'ROLE_ADMIN'

    if (!hasRole) {
        throw new Error(`Forbidden: Requires one of [${allowedRoles.join(', ')}]`)
    }

    return user
}

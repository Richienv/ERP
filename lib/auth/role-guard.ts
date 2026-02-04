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

    // 1. Try to get role from Supabase App Metadata (fastest, if using Custom Claims)
    // const role = user.app_metadata?.role

    // 2. Fallback: Get from public.users table (authoritative)
    try {
        // We can use Prisma or Supabase. Using Prisma for consistency with legacy code if available,
        // but Supabase client is already authenticated.
        // Let's use Supabase to avoid Prisma "Tenant not found" issues if RLS is tricky,
        // although Prisma 'User' table might be accessible.
        
        // Using Prisma:
        const dbUser = await prisma.user.findUnique({
            where: { email: user.email! },
            select: { role: true, id: true }
        })

        if (!dbUser) return null

        return {
            id: user.id, // Auth ID
            dbId: dbUser.id, // Public ID (should match)
            email: user.email,
            role: dbUser.role
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

    // Normalize roles for comparison (case-insensitive if needed)
    const hasRole = allowedRoles.some(role => 
        user.role.toUpperCase() === role.toUpperCase() || 
        // Allow ADMIN to do everything usually
        user.role.toUpperCase() === 'ADMIN'
    )

    if (!hasRole) {
        throw new Error(`Forbidden: Requires one of [${allowedRoles.join(', ')}]`)
    }

    return user
}

import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db"
import { DEFAULT_ROLE, SUPER_ROLES, isSuperRole } from "@/lib/authz"

export type UserRole = "admin" | "user" | "manager" | "CEO" | "DIRECTOR" | "PURCHASING" | "WAREHOUSE"

// Re-exported so callers importing from the guard see the same super-role list.
export { SUPER_ROLES, isSuperRole }

/**
 * Resolve the current user and their AUTHORITATIVE role.
 *
 * SECURITY: the role comes from `public.users.role` (database) ONLY.
 * Supabase `user_metadata` is client-writable — an authenticated user can
 * self-promote with `supabase.auth.updateUser({ data: { role: 'ADMIN' } })` —
 * so it is never read here, not even as a fallback or "fast path" cache.
 * Accounts with no database row fall back to DEFAULT_ROLE (least privilege).
 */
export async function getCurrentUserRole() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        return null
    }

    try {
        let role = ""
        let dbId = user.id

        if (user.email) {
            const dbUser = await prisma.user.findUnique({
                where: { email: user.email },
                select: { role: true, id: true }
            })
            if (dbUser) {
                dbId = dbUser.id
                if (dbUser.role) role = dbUser.role
            }
        }

        if (!role) role = DEFAULT_ROLE

        return {
            id: user.id,
            dbId,
            email: user.email,
            role
        }
    } catch (e) {
        // Fail closed: an unresolvable role must not become an elevated role.
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
    // NOTE: super roles (see SUPER_ROLES in lib/authz.ts) intentionally bypass
    // the allowedRoles whitelist — matches both "ADMIN" and "ROLE_ADMIN".
    const hasRole = allowedRoles.some(role =>
        normalizedUserRole === role.toUpperCase()
    ) || isSuperRole(user.role)

    if (!hasRole) {
        throw new Error(`Forbidden: Requires one of [${allowedRoles.join(', ')}]`)
    }

    return user
}

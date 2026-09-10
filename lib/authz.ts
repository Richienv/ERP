import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

export type AuthzUser = {
    id: string
    role: string
    email?: string | null
    employeeId?: string | null
}

/**
 * Least-privileged role in the system. Used whenever we cannot prove a higher
 * role from the database. NEVER change this to an elevated role — it is the
 * fallback for unknown / unlinked accounts.
 */
export const DEFAULT_ROLE = "ROLE_STAFF"

/**
 * SECURITY — SUPER ROLES
 *
 * Roles listed here bypass the `allowedRoles` whitelist in `assertRole()` /
 * `requireRole()`: a user holding one of these is granted access to EVERY
 * guarded action, even actions that never list the role explicitly.
 *
 * This is intentional in this codebase (admins are expected to be able to
 * operate every module), but it means a single compromised or mis-assigned
 * admin row in `public.users` is a full-system compromise. Any addition to
 * this list must be reviewed as a security change.
 *
 * Comparison is done on the normalized role (see `normalizeRole`), so both
 * "ADMIN" and "ROLE_ADMIN" match.
 */
export const SUPER_ROLES: readonly string[] = ["ADMIN"]

/** Strip ROLE_ prefix and uppercase for comparison */
function normalizeRole(role: string): string {
    return (role || "").toUpperCase().replace(/^ROLE_/, '')
}

/** True if the role bypasses the allowedRoles whitelist. See SUPER_ROLES. */
export function isSuperRole(role: string): boolean {
    return SUPER_ROLES.includes(normalizeRole(role))
}

/**
 * Resolve the authenticated user and their AUTHORITATIVE role.
 *
 * SECURITY: the role is read from the database (`public.users.role`) ONLY.
 * Supabase `user_metadata` is client-writable — any authenticated user can
 * call `supabase.auth.updateUser({ data: { role: 'ADMIN' } })` — so it must
 * never be used as an authorization source, not even as a fallback. The same
 * applies to `employeeId`: it scopes which employee's records the caller can
 * read/write, so it is resolved from the Employee table by verified email.
 *
 * If no database row backs the account, the caller gets DEFAULT_ROLE (least
 * privilege) and no employeeId.
 */
export async function getAuthzUser(): Promise<AuthzUser> {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getUser()

    if (error || !data?.user) {
        throw new Error("Unauthorized")
    }

    const email = data.user.email ?? null

    let role = ""
    let employeeId: string | null = null

    try {
        if (email) {
            const dbUser = await prisma.user.findUnique({
                where: { email },
                select: { role: true, id: true },
            })
            if (dbUser?.role) role = dbUser.role

            const emp = await prisma.employee.findFirst({
                where: { email: { equals: email, mode: 'insensitive' } },
                select: { id: true },
            })
            if (emp) employeeId = emp.id
        }
    } catch (e) {
        // Fail closed: on a DB error the caller keeps the least-privileged role.
        console.error("[getAuthzUser] DB role lookup failed:", e)
    }

    if (!role) role = DEFAULT_ROLE

    return {
        id: data.user.id,
        role,
        email,
        employeeId,
    }
}

export function assertRole(user: AuthzUser, allowedRoles: string[]) {
    const userRole = normalizeRole(user.role)
    // NOTE: super roles (see SUPER_ROLES) intentionally bypass allowedRoles.
    const hasRole = allowedRoles.some(r => normalizeRole(r) === userRole) ||
        isSuperRole(user.role)

    if (!hasRole) {
        throw new Error("Forbidden")
    }
}

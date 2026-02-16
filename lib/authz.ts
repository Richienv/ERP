import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

export type AuthzUser = {
    id: string
    role: string
    email?: string | null
    employeeId?: string | null
}

export async function getAuthzUser(): Promise<AuthzUser> {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getUser()

    if (error || !data?.user) {
        throw new Error("Unauthorized")
    }

    const metadata = (data.user.user_metadata as any) || {}
    let role = metadata?.role || ""
    let employeeId = metadata?.employeeId || metadata?.employee_id || null

    // Fallback: lookup role & employeeId from DB if metadata is empty
    if (!role || !employeeId) {
        try {
            const dbUser = data.user.email
                ? await prisma.user.findUnique({
                    where: { email: data.user.email },
                    select: { role: true, id: true },
                })
                : null

            if (dbUser) {
                if (!role) role = dbUser.role || "ROLE_STAFF"
            }

            if (!employeeId && data.user.email) {
                const emp = await prisma.employee.findFirst({
                    where: { email: { equals: data.user.email, mode: 'insensitive' } },
                    select: { id: true },
                })
                if (emp) employeeId = emp.id
            }
        } catch (e) {
            console.error("[getAuthzUser] DB fallback failed:", e)
        }
    }

    if (!role) role = "ROLE_STAFF"

    return {
        id: data.user.id,
        role,
        email: data.user.email,
        employeeId,
    }
}

export function assertRole(user: AuthzUser, allowedRoles: string[]) {
    const normalizedUserRole = user.role.toUpperCase()
    const hasRole = allowedRoles.some(r => r.toUpperCase() === normalizedUserRole) ||
        normalizedUserRole === 'ADMIN' ||
        normalizedUserRole === 'ROLE_ADMIN'

    if (!hasRole) {
        throw new Error("Forbidden")
    }
}

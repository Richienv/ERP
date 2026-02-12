import { createClient } from "@/lib/supabase/server"

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
    const role = metadata?.role || "ROLE_STAFF"
    const employeeId = metadata?.employeeId || metadata?.employee_id || null

    return {
        id: data.user.id,
        role,
        email: data.user.email,
        employeeId,
    }
}

export function assertRole(user: AuthzUser, allowedRoles: string[]) {
    if (!allowedRoles.includes(user.role)) {
        throw new Error("Forbidden")
    }
}

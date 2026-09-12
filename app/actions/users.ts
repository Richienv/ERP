"use server"

import { prisma } from "@/lib/prisma"
import { assertRole, getAuthzUser, SUPER_ROLES } from "@/lib/authz"

/** Roles that may be written to public.users.role — exact match only. */
const ASSIGNABLE_ROLES = [
    "ADMIN",
    "ROLE_ACCOUNTANT",
    "ROLE_MANAGER",
    "ROLE_STAFF",
    "ROLE_PURCHASING",
    "ROLE_CEO",
    "ROLE_DIRECTOR",
] as const

type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]

type ListedUser = {
    id: string
    email: string
    name: string | null
    role: string
    updatedAt: Date
}

function isAssignableRole(role: string): role is AssignableRole {
    return (ASSIGNABLE_ROLES as readonly string[]).includes(role)
}

function authzErrorMessage(error: unknown, fallback: string): string {
    const message = error instanceof Error ? error.message : ""
    if (message === "Unauthorized") {
        return "Anda belum masuk. Silakan login kembali."
    }
    if (message === "Forbidden") {
        return "Anda tidak memiliki izin untuk mengelola pengguna."
    }
    return fallback
}

export async function listUsers(): Promise<
    { success: true; data: ListedUser[] } | { success: false; error: string }
> {
    try {
        const user = await getAuthzUser()
        assertRole(user, SUPER_ROLES as string[])

        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                updatedAt: true,
            },
            orderBy: { email: "asc" },
        })

        return { success: true, data: users }
    } catch (error) {
        console.error("[listUsers]", error)
        return {
            success: false,
            error: authzErrorMessage(error, "Gagal memuat daftar pengguna."),
        }
    }
}

export async function setUserRole(
    userId: string,
    role: string,
): Promise<{ success: true } | { success: false; error: string }> {
    try {
        const user = await getAuthzUser()
        assertRole(user, SUPER_ROLES as string[])

        if (!userId?.trim()) {
            return { success: false, error: "ID pengguna tidak valid." }
        }

        if (!isAssignableRole(role)) {
            return { success: false, error: "Peran tidak diizinkan." }
        }

        await prisma.user.update({
            where: { id: userId },
            data: { role },
        })

        return { success: true }
    } catch (error) {
        console.error("[setUserRole]", error)
        return {
            success: false,
            error: authzErrorMessage(error, "Gagal mengubah peran pengguna."),
        }
    }
}

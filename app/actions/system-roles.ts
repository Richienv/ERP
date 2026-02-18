'use server'

import { withPrismaAuth } from '@/lib/db'
import { z } from 'zod'

// Validation Schema
const roleSchema = z.object({
    code: z.string().min(2, 'Code must be at least 2 characters').toUpperCase(),
    name: z.string().min(3, 'Name must be at least 3 characters'),
    description: z.string().optional(),
    permissions: z.array(z.string()).default([]),
})

export async function getSystemRoles() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const roles = await prisma.systemRole.findMany({
                orderBy: { createdAt: 'asc' },
            })
            return { success: true, data: roles }
        })
    } catch (error) {
        console.error('Failed to fetch roles:', error)
        return { success: false, error: 'Failed to fetch roles' }
    }
}

export async function createSystemRole(data: z.infer<typeof roleSchema>) {
    const result = roleSchema.safeParse(data)

    if (!result.success) {
        return { success: false, error: result.error.errors[0].message }
    }

    try {
        return await withPrismaAuth(async (prisma) => {
            const existing = await prisma.systemRole.findUnique({
                where: { code: result.data.code }
            })

            if (existing) {
                return { success: false, error: 'Role code already exists' }
            }

            const role = await prisma.systemRole.create({
                data: result.data
            })

            return { success: true, data: role }
        })
    } catch (error) {
        console.error('Failed to create role:', error)
        return { success: false, error: 'Failed to create role' }
    }
}

export async function updateSystemRole(id: string, data: Partial<z.infer<typeof roleSchema>>) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const role = await prisma.systemRole.update({
                where: { id },
                data: data
            })
            return { success: true, data: role }
        })
    } catch (error) {
        console.error('Failed to update role:', error)
        return { success: false, error: 'Failed to update role' }
    }
}

export async function deleteSystemRole(id: string) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const role = await prisma.systemRole.findUnique({ where: { id } })
            if (role?.isSystem) {
                return { success: false, error: 'Cannot delete system role' }
            }

            await prisma.systemRole.delete({
                where: { id }
            })
            return { success: true, message: 'Role deleted' }
        })
    } catch (error) {
        console.error('Failed to delete role:', error)
        return { success: false, error: 'Failed to delete role' }
    }
}

"use server"

import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

const ROUTING_MAP: Record<string, string> = {
    INVOICE: "Finance",
    JOURNAL: "Finance",
    EXPENSE: "Finance",
    PO: "Procurement",
    PR: "Procurement",
    PRODUCT: "Warehouse",
    STOCK: "Warehouse",
    WORK_ORDER: "Manufacturing",
    MACHINE: "Manufacturing",
    QUALITY: "Manufacturing",
    EMPLOYEE: "HR",
    ATTENDANCE: "HR",
    LEAVE: "HR",
    SALES_ORDER: "Sales",
    CUSTOMER: "Sales",
}

export async function createCeoFlag(input: {
    title: string
    note?: string
    sourceType: string
    sourceId: string
    sourceLabel: string
}) {
    const user = await requireAuth()
    const targetDept = ROUTING_MAP[input.sourceType] ?? "Finance"

    const flag = await prisma.ceoFlag.create({
        data: {
            title: input.title,
            note: input.note || null,
            targetDept,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            sourceLabel: input.sourceLabel,
            createdBy: user.id,
        },
    })

    return { success: true, flagId: flag.id }
}

export async function getCeoFlags(options?: { targetDept?: string; status?: string; limit?: number }) {
    await requireAuth()

    try {
        const flags = await prisma.ceoFlag.findMany({
            where: {
                ...(options?.targetDept ? { targetDept: options.targetDept } : {}),
                ...(options?.status ? { status: options.status as any } : {}),
            },
            orderBy: { createdAt: "desc" },
            take: options?.limit ?? 20,
        })

        return flags.map(f => ({
            id: f.id,
            title: f.title,
            note: f.note,
            targetDept: f.targetDept,
            sourceType: f.sourceType,
            sourceId: f.sourceId,
            sourceLabel: f.sourceLabel,
            status: f.status,
            createdAt: f.createdAt.toISOString(),
            readAt: f.readAt?.toISOString() ?? null,
            actedAt: f.actedAt?.toISOString() ?? null,
        }))
    } catch {
        // Table may not exist yet if migration hasn't been run
        return []
    }
}

export async function markFlagRead(flagId: string) {
    const user = await requireAuth()
    await prisma.ceoFlag.update({
        where: { id: flagId },
        data: { status: "READ", readBy: user.id, readAt: new Date() },
    })
    return { success: true }
}

export async function markFlagActed(flagId: string) {
    await requireAuth()
    await prisma.ceoFlag.update({
        where: { id: flagId },
        data: { status: "ACTED", actedAt: new Date() },
    })
    return { success: true }
}

export async function dismissFlag(flagId: string) {
    await requireAuth()
    await prisma.ceoFlag.update({
        where: { id: flagId },
        data: { status: "DISMISSED" },
    })
    return { success: true }
}

export async function getPendingFlagCount() {
    await requireAuth()
    try {
        return await prisma.ceoFlag.count({ where: { status: "PENDING" } })
    } catch {
        // Table may not exist yet if migration hasn't been run
        return 0
    }
}

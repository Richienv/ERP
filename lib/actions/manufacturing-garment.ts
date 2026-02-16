'use server'

import { prisma, withPrismaAuth } from "@/lib/db"
import { PrismaClient, GarmentStage } from "@prisma/client"
import { createClient } from "@/lib/supabase/server"
import { assertStageTransition, STAGE_ORDER } from "@/lib/garment-stage-machine"
import { revalidatePath } from "next/cache"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// ==============================================================================
// Types
// ==============================================================================

export interface WorkOrderWithStage {
    id: string
    number: string
    productName: string
    productCode: string
    stage: GarmentStage | null
    status: string
    plannedQty: number
    actualQty: number
    startDate: string | null
    dueDate: string | null
    scheduledStart: string | null
    scheduledEnd: string | null
    machineName: string | null
    priority: string
}

export interface StageKanbanData {
    stage: GarmentStage
    workOrders: WorkOrderWithStage[]
    count: number
}

// ==============================================================================
// Read Actions (use singleton prisma to avoid connection pool exhaustion)
// ==============================================================================

export async function getWorkOrdersByStage(): Promise<StageKanbanData[]> {
    try {
        await requireAuth()

        const workOrders = await prisma.workOrder.findMany({
            where: {
                status: { in: ['PLANNED', 'IN_PROGRESS'] },
                stage: { not: null },
            },
            include: {
                product: { select: { name: true, code: true } },
                machine: { select: { name: true } },
            },
            orderBy: [
                { priority: 'desc' },
                { dueDate: 'asc' },
            ],
        })

        return STAGE_ORDER.map((stage) => {
            const filtered = workOrders
                .filter((wo) => wo.stage === stage)
                .map((wo) => ({
                    id: wo.id,
                    number: wo.number,
                    productName: wo.product.name,
                    productCode: wo.product.code,
                    stage: wo.stage,
                    status: wo.status,
                    plannedQty: wo.plannedQty,
                    actualQty: wo.actualQty,
                    startDate: wo.startDate?.toISOString() ?? null,
                    dueDate: wo.dueDate?.toISOString() ?? null,
                    scheduledStart: wo.scheduledStart?.toISOString() ?? null,
                    scheduledEnd: wo.scheduledEnd?.toISOString() ?? null,
                    machineName: wo.machine?.name ?? null,
                    priority: wo.priority,
                }))

            return {
                stage,
                workOrders: filtered,
                count: filtered.length,
            }
        })
    } catch (error) {
        console.error("[getWorkOrdersByStage] Error:", error)
        return STAGE_ORDER.map((stage) => ({
            stage,
            workOrders: [],
            count: 0,
        }))
    }
}

export async function getSchedulableWorkOrders(): Promise<WorkOrderWithStage[]> {
    try {
        await requireAuth()

        const workOrders = await prisma.workOrder.findMany({
            where: {
                status: { in: ['PLANNED', 'IN_PROGRESS'] },
            },
            include: {
                product: { select: { name: true, code: true } },
                machine: { select: { name: true } },
            },
            orderBy: [
                { scheduledStart: 'asc' },
                { dueDate: 'asc' },
            ],
        })

        return workOrders.map((wo) => ({
            id: wo.id,
            number: wo.number,
            productName: wo.product.name,
            productCode: wo.product.code,
            stage: wo.stage,
            status: wo.status,
            plannedQty: wo.plannedQty,
            actualQty: wo.actualQty,
            startDate: wo.startDate?.toISOString() ?? null,
            dueDate: wo.dueDate?.toISOString() ?? null,
            scheduledStart: wo.scheduledStart?.toISOString() ?? null,
            scheduledEnd: wo.scheduledEnd?.toISOString() ?? null,
            machineName: wo.machine?.name ?? null,
            priority: wo.priority,
        }))
    } catch (error) {
        console.error("[getSchedulableWorkOrders] Error:", error)
        return []
    }
}

// ==============================================================================
// Write Actions (keep withPrismaAuth for transactional safety)
// ==============================================================================

export async function transitionWorkOrderStage(
    workOrderId: string,
    newStage: GarmentStage
): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            const wo = await prisma.workOrder.findUniqueOrThrow({
                where: { id: workOrderId },
                select: { stage: true, status: true },
            })

            if (!wo.stage) {
                throw new Error('Work order tidak memiliki stage garment')
            }

            assertStageTransition(wo.stage, newStage)

            // Auto-start work order if moving from CUTTING
            const updates: Record<string, unknown> = { stage: newStage }
            if (wo.status === 'PLANNED' && newStage !== 'CUTTING') {
                updates.status = 'IN_PROGRESS'
            }
            if (newStage === 'DONE') {
                updates.status = 'COMPLETED'
            }

            await prisma.workOrder.update({
                where: { id: workOrderId },
                data: updates,
            })
        })

        revalidatePath('/manufacturing/orders')
        return { success: true }
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Gagal mengubah stage'
        console.error("[transitionWorkOrderStage] Error:", error)
        return { success: false, error: msg }
    }
}

export async function getMachinesForScheduling(): Promise<{ id: string; name: string; code: string; status: string }[]> {
    try {
        await requireAuth()

        return prisma.machine.findMany({
            where: { isActive: true },
            select: { id: true, name: true, code: true, status: true },
            orderBy: { name: 'asc' },
        })
    } catch (error) {
        console.error("[getMachinesForScheduling] Error:", error)
        return []
    }
}

export async function getRoutingsForScheduling(): Promise<{ id: string; name: string; code: string }[]> {
    try {
        await requireAuth()

        return prisma.routing.findMany({
            where: { isActive: true },
            select: { id: true, name: true, code: true },
            orderBy: { name: 'asc' },
        })
    } catch (error) {
        console.error("[getRoutingsForScheduling] Error:", error)
        return []
    }
}

export async function scheduleWorkOrder(
    workOrderId: string,
    data: {
        scheduledStart: string
        scheduledEnd: string
        machineId?: string
        routingId?: string
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            await prisma.workOrder.update({
                where: { id: workOrderId },
                data: {
                    scheduledStart: new Date(data.scheduledStart),
                    scheduledEnd: new Date(data.scheduledEnd),
                    ...(data.machineId && { machineId: data.machineId }),
                    ...(data.routingId && { routingId: data.routingId }),
                },
            })
        })

        revalidatePath('/manufacturing/schedule')
        revalidatePath('/manufacturing/orders')
        return { success: true }
    } catch (error) {
        console.error("[scheduleWorkOrder] Error:", error)
        return { success: false, error: 'Gagal menjadwalkan work order' }
    }
}

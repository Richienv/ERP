'use server'

import { prisma, withPrismaAuth } from "@/lib/db"
import { PrismaClient, ShiftType, DowntimeCategory } from "@prisma/client"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { calculateOEE, type OEEMetrics } from "@/lib/dashboard-textile-helpers"
export type { OEEMetrics } from "@/lib/dashboard-textile-helpers"

// Helper: lightweight auth check for read-only queries (no transaction needed)
async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// ==============================================================================
// Types
// ==============================================================================

export interface TextileKPIs {
    fabricRollsAvailable: number
    totalFabricMeters: number
    activeCutPlans: number
    activeSubcontractOrders: number
    pendingTransfers: number
}

export interface CashFlowProjection {
    inflows: { label: string; amount: number }[]
    outflows: { label: string; amount: number }[]
    netProjected: number
}

export interface OverdueAlert {
    id: string
    type: 'QUOTATION_EXPIRING' | 'PO_OVERDUE' | 'SUBCONTRACT_LATE' | 'LOW_FABRIC'
    title: string
    detail: string
    severity: 'warning' | 'critical'
    link?: string
}

export interface ShiftNoteItem {
    id: string
    shiftDate: string
    shiftType: ShiftType
    content: string
    creatorName: string
    createdAt: string
}

export interface DowntimeLogItem {
    id: string
    machineName: string
    machineCode: string
    category: DowntimeCategory
    startTime: string
    endTime: string | null
    durationMinutes: number | null
    notes: string | null
    loggerName: string
}

// ==============================================================================
// Server Actions: Read
// ==============================================================================

export async function getTextileKPIs(): Promise<TextileKPIs> {
    try {
        await requireAuth()

        // Sequential queries to avoid exhausting connection pool
        const fabricRolls = await prisma.fabricRoll.aggregate({
            where: { status: 'AVAILABLE' },
            _count: { id: true },
            _sum: { lengthMeters: true },
        })
        const cutPlans = await prisma.cutPlan.count({
            where: { status: { in: ['CP_DRAFT', 'FABRIC_ALLOCATED', 'IN_CUTTING'] } },
        })
        const scOrders = await prisma.subcontractOrder.count({
            where: { status: { in: ['SC_SENT', 'SC_IN_PROGRESS', 'SC_PARTIAL_COMPLETE'] } },
        })
        const transfers = await prisma.stockTransfer.count({
            where: { status: { in: ['DRAFT', 'PENDING_APPROVAL', 'IN_TRANSIT'] } },
        })

        return {
            fabricRollsAvailable: fabricRolls._count.id,
            totalFabricMeters: Number(fabricRolls._sum.lengthMeters ?? 0),
            activeCutPlans: cutPlans,
            activeSubcontractOrders: scOrders,
            pendingTransfers: transfers,
        }
    } catch (error) {
        console.error("[getTextileKPIs] Error:", error)
        return {
            fabricRollsAvailable: 0,
            totalFabricMeters: 0,
            activeCutPlans: 0,
            activeSubcontractOrders: 0,
            pendingTransfers: 0,
        }
    }
}

export async function getOEEMetrics(): Promise<OEEMetrics> {
    try {
        await requireAuth()

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        // Get today's downtime
        const downtimeLogs = await prisma.machineDowntimeLog.findMany({
            where: {
                startTime: { gte: today, lt: tomorrow },
            },
        })

        let totalDowntimeMinutes = 0
        for (const log of downtimeLogs) {
            const end = log.endTime ?? new Date()
            const diff = (end.getTime() - log.startTime.getTime()) / 60000
            totalDowntimeMinutes += diff
        }

        // Get active machines count for theoretical capacity
        const activeMachines = await prisma.machine.count({
            where: { isActive: true, status: { not: 'OFFLINE' } },
        })

        // Standard 8h × active machines
        const scheduledMinutes = activeMachines * 8 * 60

        // Get today's production (work orders completed)
        const todaysProduction = await prisma.workOrder.aggregate({
            where: {
                updatedAt: { gte: today, lt: tomorrow },
                status: { in: ['IN_PROGRESS', 'COMPLETED'] },
            },
            _sum: { actualQty: true },
        })

        // Theoretical capacity from machines
        const machines = await prisma.machine.findMany({
            where: { isActive: true, status: { not: 'OFFLINE' } },
            select: { capacityPerHour: true, standardHoursPerDay: true },
        })
        const theoreticalCapacity = machines.reduce((sum, m) =>
            sum + (m.capacityPerHour ?? 0) * m.standardHoursPerDay, 0)

        // Get defects from today's inspections
        const defects = await prisma.qualityInspection.aggregate({
            where: {
                inspectionDate: { gte: today, lt: tomorrow },
                status: 'FAIL',
            },
            _count: { id: true },
        })

        const totalProduced = Number(todaysProduction._sum.actualQty ?? 0)

        return calculateOEE({
            scheduledMinutes,
            downtimeMinutes: Math.round(totalDowntimeMinutes),
            totalProduced,
            theoreticalCapacity: theoreticalCapacity > 0 ? theoreticalCapacity : totalProduced,
            defects: defects._count.id,
        })
    } catch (error) {
        console.error("[getOEEMetrics] Error:", error)
        return calculateOEE({
            scheduledMinutes: 0,
            downtimeMinutes: 0,
            totalProduced: 0,
            theoreticalCapacity: 0,
            defects: 0,
        })
    }
}

export async function getOverdueAlerts(): Promise<OverdueAlert[]> {
    try {
        await requireAuth()

        const alerts: OverdueAlert[] = []
        const now = new Date()
        const threeDaysFromNow = new Date(now)
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)

        // Expiring quotations
        const expiringQuotations = await prisma.quotation.findMany({
            where: {
                status: 'SENT',
                validUntil: { lte: threeDaysFromNow, gte: now },
            },
            select: { id: true, number: true, validUntil: true },
            take: 5,
        })
        for (const q of expiringQuotations) {
            const daysLeft = Math.ceil((q.validUntil.getTime() - now.getTime()) / 86400000)
            alerts.push({
                id: q.id,
                type: 'QUOTATION_EXPIRING',
                title: `Penawaran ${q.number} akan kadaluarsa`,
                detail: `${daysLeft} hari lagi`,
                severity: daysLeft <= 1 ? 'critical' : 'warning',
                link: `/sales/quotations`,
            })
        }

        // Late subcontract orders
        const lateSubcontracts = await prisma.subcontractOrder.findMany({
            where: {
                status: { in: ['SC_SENT', 'SC_IN_PROGRESS'] },
                expectedReturnDate: { lt: now },
            },
            include: { subcontractor: { select: { name: true } } },
            take: 5,
        })
        for (const sc of lateSubcontracts) {
            const daysLate = Math.ceil((now.getTime() - (sc.expectedReturnDate?.getTime() ?? 0)) / 86400000)
            alerts.push({
                id: sc.id,
                type: 'SUBCONTRACT_LATE',
                title: `SC ${sc.number} terlambat`,
                detail: `${sc.subcontractor.name} — ${daysLate} hari`,
                severity: daysLate > 3 ? 'critical' : 'warning',
                link: `/subcontract`,
            })
        }

        // Low fabric rolls
        const lowFabric = await prisma.fabricRoll.groupBy({
            by: ['productId'],
            where: { status: 'AVAILABLE' },
            _sum: { lengthMeters: true },
            _count: { id: true },
            having: { id: { _count: { lte: 2 } } },
        })
        for (const f of lowFabric.slice(0, 3)) {
            alerts.push({
                id: f.productId,
                type: 'LOW_FABRIC',
                title: `Stok kain rendah`,
                detail: `${f._count.id} rol tersisa (${Number(f._sum.lengthMeters ?? 0).toFixed(0)}m)`,
                severity: f._count.id <= 1 ? 'critical' : 'warning',
                link: `/inventory/fabric-rolls`,
            })
        }

        return alerts
    } catch (error) {
        console.error("[getOverdueAlerts] Error:", error)
        return []
    }
}

export async function getRecentShiftNotes(limit = 5): Promise<ShiftNoteItem[]> {
    try {
        await requireAuth()

        const notes = await prisma.shiftNote.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                creator: { select: { firstName: true, lastName: true } },
            },
        })

        return notes.map((n) => ({
            id: n.id,
            shiftDate: n.shiftDate.toISOString(),
            shiftType: n.shiftType,
            content: n.content,
            creatorName: [n.creator.firstName, n.creator.lastName].filter(Boolean).join(' '),
            createdAt: n.createdAt.toISOString(),
        }))
    } catch (error) {
        console.error("[getRecentShiftNotes] Error:", error)
        return []
    }
}

export async function getRecentDowntimeLogs(limit = 10): Promise<DowntimeLogItem[]> {
    try {
        await requireAuth()

        const logs = await prisma.machineDowntimeLog.findMany({
            orderBy: { startTime: 'desc' },
            take: limit,
            include: {
                machine: { select: { name: true, code: true } },
                logger: { select: { firstName: true, lastName: true } },
            },
        })

        return logs.map((l) => {
            const durationMinutes = l.endTime
                ? Math.round((l.endTime.getTime() - l.startTime.getTime()) / 60000)
                : null

            return {
                id: l.id,
                machineName: l.machine.name,
                machineCode: l.machine.code,
                category: l.category,
                startTime: l.startTime.toISOString(),
                endTime: l.endTime?.toISOString() ?? null,
                durationMinutes,
                notes: l.notes,
                loggerName: [l.logger.firstName, l.logger.lastName].filter(Boolean).join(' '),
            }
        })
    } catch (error) {
        console.error("[getRecentDowntimeLogs] Error:", error)
        return []
    }
}

// ==============================================================================
// Server Actions: Write
// ==============================================================================

export async function createShiftNote(data: {
    shiftDate: string
    shiftType: ShiftType
    content: string
    createdBy: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            await prisma.shiftNote.create({
                data: {
                    shiftDate: new Date(data.shiftDate),
                    shiftType: data.shiftType,
                    content: data.content,
                    createdBy: data.createdBy,
                },
            })
        })

        revalidatePath('/dashboard')
        return { success: true }
    } catch (error) {
        console.error("[createShiftNote] Error:", error)
        return { success: false, error: 'Gagal membuat catatan shift' }
    }
}

export async function logMachineDowntime(data: {
    machineId: string
    category: DowntimeCategory
    startTime: string
    endTime?: string
    notes?: string
    loggedBy: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            await prisma.machineDowntimeLog.create({
                data: {
                    machineId: data.machineId,
                    category: data.category,
                    startTime: new Date(data.startTime),
                    endTime: data.endTime ? new Date(data.endTime) : null,
                    notes: data.notes ?? null,
                    loggedBy: data.loggedBy,
                },
            })
        })

        revalidatePath('/dashboard')
        return { success: true }
    } catch (error) {
        console.error("[logMachineDowntime] Error:", error)
        return { success: false, error: 'Gagal mencatat downtime mesin' }
    }
}

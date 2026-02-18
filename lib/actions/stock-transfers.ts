'use server'

import { prisma, withPrismaAuth } from "@/lib/db"
import { PrismaClient, TransferStatus } from "@prisma/client"
import { createClient } from "@/lib/supabase/server"
import { assertTransferTransition } from "@/lib/stock-transfer-machine"
import { getAuthzUser } from "@/lib/authz"
import { resolveEmployeeContext } from "@/lib/employee-context"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// ==============================================================================
// Types
// ==============================================================================

export interface StockTransferSummary {
    id: string
    number: string
    fromWarehouse: string
    toWarehouse: string
    productName: string
    productCode: string
    quantity: number
    status: TransferStatus
    requesterName: string
    approverName: string | null
    notes: string | null
    createdAt: string
}

// ==============================================================================
// Read Actions
// ==============================================================================

export async function getStockTransfers(filters?: {
    status?: TransferStatus
}): Promise<StockTransferSummary[]> {
    try {
        await requireAuth()

        const where: Record<string, unknown> = {}
        if (filters?.status) where.status = filters.status

        const transfers = await prisma.stockTransfer.findMany({
            where,
            include: {
                fromWarehouse: { select: { name: true } },
                toWarehouse: { select: { name: true } },
                product: { select: { name: true, code: true } },
                requester: { select: { firstName: true, lastName: true } },
                approver: { select: { firstName: true, lastName: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        })

        return transfers.map((t) => ({
            id: t.id,
            number: t.number,
            fromWarehouse: t.fromWarehouse.name,
            toWarehouse: t.toWarehouse.name,
            productName: t.product.name,
            productCode: t.product.code,
            quantity: t.quantity,
            status: t.status,
            requesterName: [t.requester.firstName, t.requester.lastName].filter(Boolean).join(' '),
            approverName: t.approver
                ? [t.approver.firstName, t.approver.lastName].filter(Boolean).join(' ')
                : null,
            notes: t.notes,
            createdAt: t.createdAt.toISOString(),
        }))
    } catch (error) {
        console.error("[getStockTransfers] Error:", error)
        return []
    }
}

export async function getTransferFormData(): Promise<{
    warehouses: { id: string; name: string; code: string }[]
    products: { id: string; name: string; code: string }[]
}> {
    try {
        await requireAuth()

        const [warehouses, products] = await Promise.all([
            prisma.warehouse.findMany({
                where: { isActive: true },
                select: { id: true, name: true, code: true },
                orderBy: { name: 'asc' },
            }),
            prisma.product.findMany({
                where: { isActive: true },
                select: { id: true, name: true, code: true },
                orderBy: { name: 'asc' },
            }),
        ])
        return { warehouses, products }
    } catch (error) {
        console.error("[getTransferFormData] Error:", error)
        return { warehouses: [], products: [] }
    }
}

// ==============================================================================
// Write Actions
// ==============================================================================

export async function createStockTransfer(data: {
    fromWarehouseId: string
    toWarehouseId: string
    productId: string
    quantity: number
    notes?: string
}): Promise<{ success: boolean; transferId?: string; error?: string }> {
    try {
        if (data.fromWarehouseId === data.toWarehouseId) {
            return { success: false, error: 'Gudang asal dan tujuan tidak boleh sama' }
        }
        if (data.quantity <= 0) {
            return { success: false, error: 'Qty harus > 0' }
        }

        // Resolve employee BEFORE transaction to avoid connection pool contention
        const authUser = await getAuthzUser()
        const empCtx = await resolveEmployeeContext(prisma, authUser, { requireActive: false })
        if (!empCtx) {
            return { success: false, error: 'Profil karyawan tidak ditemukan. Pastikan email akun terhubung ke data karyawan.' }
        }

        const transferId = await withPrismaAuth(async (tx: PrismaClient) => {
            // Generate transfer number
            const count = await tx.stockTransfer.count()
            const number = `TRF-${String(count + 1).padStart(5, '0')}`

            const transfer = await tx.stockTransfer.create({
                data: {
                    number,
                    fromWarehouseId: data.fromWarehouseId,
                    toWarehouseId: data.toWarehouseId,
                    productId: data.productId,
                    quantity: data.quantity,
                    requestedBy: empCtx.id,
                    notes: data.notes ?? null,
                    status: 'DRAFT',
                },
            })

            return transfer.id
        })

        return { success: true, transferId }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal membuat transfer'
        console.error("[createStockTransfer] Error:", error)
        return { success: false, error: msg }
    }
}

export async function transitionStockTransfer(
    transferId: string,
    newStatus: TransferStatus
): Promise<{ success: boolean; error?: string }> {
    try {
        // Resolve employee BEFORE transaction for approval
        let approverId: string | null = null
        if (newStatus === 'APPROVED') {
            const authUser = await getAuthzUser()
            const empCtx = await resolveEmployeeContext(prisma, authUser, { requireActive: false })
            if (empCtx) approverId = empCtx.id
        }

        await withPrismaAuth(async (tx: PrismaClient) => {
            const transfer = await tx.stockTransfer.findUniqueOrThrow({
                where: { id: transferId },
                select: { status: true },
            })

            assertTransferTransition(transfer.status, newStatus)

            const updates: Record<string, unknown> = { status: newStatus }
            if (approverId) updates.approvedBy = approverId

            await tx.stockTransfer.update({
                where: { id: transferId },
                data: updates,
            })
        })

        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal mengubah status transfer'
        console.error("[transitionStockTransfer] Error:", error)
        return { success: false, error: msg }
    }
}

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prismaMock } from '../test-setup'

// The route handler imports `prisma` from '@/lib/prisma' (already mocked
// in test-setup), but the underlying `deleteProduct` server action
// imports from '@/lib/db' — also mock that path so both share the same
// prismaMock instance.
vi.mock('../lib/db', () => ({
    __esModule: true,
    prisma: prismaMock,
    withPrismaAuth: (cb: any) => cb(prismaMock),
    safeQuery: (cb: any) => cb(),
    withRetry: (cb: any) => cb(),
}))

// The auth-helpers and audit-helpers also need to no-op so we don't hit
// real prisma during the deleteProduct flow.
vi.mock('../lib/audit-helpers', () => ({
    logAudit: vi.fn().mockResolvedValue(undefined),
    computeChanges: vi.fn().mockReturnValue({}),
}))

// Role guard added in Round-5 (Task 34). Bypass it in tests so we can
// exercise the FK-check logic directly.
vi.mock('../lib/auth/role-guard', () => ({
    requireRole: vi.fn().mockResolvedValue({ id: 'test-user', email: 'test@example.com' }),
    requireUser: vi.fn().mockResolvedValue({ id: 'test-user', email: 'test@example.com' }),
    getCurrentUserRole: vi.fn().mockResolvedValue('admin'),
}))

// Import the route handler — all mocks are active by the time it loads.
import { DELETE } from '../app/api/products/[id]/route'

/**
 * Helper that sets every FK probe inside `deleteProduct` to "no
 * dependency found", so the action falls through to the soft-delete
 * branch. Individual tests can override one specific probe to assert
 * that the action blocks correctly when that relation has data.
 */
function mockNoDependencies() {
    prismaMock.bOMItem.findFirst.mockResolvedValue(null as any)
    prismaMock.billOfMaterials.findFirst.mockResolvedValue(null as any)
    prismaMock.workOrder.findFirst.mockResolvedValue(null as any)
    prismaMock.quotationItem.findFirst.mockResolvedValue(null as any)
    prismaMock.salesOrderItem.findFirst.mockResolvedValue(null as any)
    prismaMock.purchaseOrderItem.findFirst.mockResolvedValue(null as any)
    prismaMock.inventoryTransaction.findFirst.mockResolvedValue(null as any)
    prismaMock.qualityInspection.findFirst.mockResolvedValue(null as any)
    prismaMock.priceListItem.findFirst.mockResolvedValue(null as any)
    prismaMock.stockLevel.findMany.mockResolvedValue([] as any)
    prismaMock.stockReservation.findFirst.mockResolvedValue(null as any)
    prismaMock.fabricRoll.findFirst.mockResolvedValue(null as any)
}

describe('Product DELETE /api/products/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    const makeRequest = () =>
        new NextRequest('http://localhost:3002/api/products/prod-1', { method: 'DELETE' })

    const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })

    it('should return 404 when product does not exist', async () => {
        prismaMock.product.findUnique.mockResolvedValue(null)

        const response = await DELETE(makeRequest(), makeParams('nonexistent'))
        const body = await response.json()

        expect(response.status).toBe(404)
        expect(body.success).toBe(false)
        expect(body.error).toBeDefined()
    })

    it('should soft-delete a product with zero dependencies', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: 'prod-clean' } as any)
        mockNoDependencies()
        prismaMock.product.update.mockResolvedValue({} as any)

        const response = await DELETE(makeRequest(), makeParams('prod-clean'))
        const body = await response.json()

        expect(body.success).toBe(true)
        // We always soft-delete now (no hard delete) to preserve audit history.
        expect(prismaMock.product.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'prod-clean' },
                data: expect.objectContaining({ isActive: false }),
            })
        )
        expect(prismaMock.product.delete).not.toHaveBeenCalled()
    })

    it('should block delete when product has stock', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: 'prod-stock' } as any)
        mockNoDependencies()
        // Override stockLevel to return non-zero stock.
        prismaMock.stockLevel.findMany.mockResolvedValue([{ quantity: 10 }] as any)

        const response = await DELETE(makeRequest(), makeParams('prod-stock'))
        const body = await response.json()

        expect(response.status).toBe(409)
        expect(body.success).toBe(false)
        expect(body.error).toContain('stok')
        expect(prismaMock.product.update).not.toHaveBeenCalled()
    })

    it('should block delete when product is in an active Sales Order', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: 'prod-sales' } as any)
        mockNoDependencies()
        prismaMock.salesOrderItem.findFirst.mockResolvedValue({
            salesOrder: { number: 'SO-001' },
        } as any)

        const response = await DELETE(makeRequest(), makeParams('prod-sales'))
        const body = await response.json()

        expect(response.status).toBe(409)
        expect(body.success).toBe(false)
        expect(body.error).toContain('Sales Order')
        expect(body.error).toContain('SO-001')
    })

    it('should block delete when product is in an active Purchase Order', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: 'prod-po' } as any)
        mockNoDependencies()
        prismaMock.purchaseOrderItem.findFirst.mockResolvedValue({
            purchaseOrder: { number: 'PO-099' },
        } as any)

        const response = await DELETE(makeRequest(), makeParams('prod-po'))
        const body = await response.json()

        expect(response.status).toBe(409)
        expect(body.success).toBe(false)
        expect(body.error).toContain('Purchase Order')
        expect(body.error).toContain('PO-099')
    })

    it('should block delete when product has a BOMItem reference', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: 'prod-bom' } as any)
        mockNoDependencies()
        prismaMock.bOMItem.findFirst.mockResolvedValueOnce(null as any)
        // Second findFirst (anyBomItem, no `bom: { isActive: true }` filter) returns a hit.
        prismaMock.bOMItem.findFirst.mockResolvedValueOnce({ id: 'bomi-1' } as any)

        const response = await DELETE(makeRequest(), makeParams('prod-bom'))
        const body = await response.json()

        expect(response.status).toBe(409)
        expect(body.success).toBe(false)
        expect(body.error).toContain('BOMItem')
    })

    it('should block delete when product has Inventory Transactions (audit trail)', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: 'prod-tx' } as any)
        mockNoDependencies()
        prismaMock.inventoryTransaction.findFirst.mockResolvedValue({ id: 'tx-1' } as any)

        const response = await DELETE(makeRequest(), makeParams('prod-tx'))
        const body = await response.json()

        expect(response.status).toBe(409)
        expect(body.success).toBe(false)
        expect(body.error).toContain('audit')
    })

    it('should block delete when product is in a Price List', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: 'prod-pl' } as any)
        mockNoDependencies()
        prismaMock.priceListItem.findFirst.mockResolvedValue({
            priceList: { name: 'Tier-A' },
        } as any)

        const response = await DELETE(makeRequest(), makeParams('prod-pl'))
        const body = await response.json()

        expect(response.status).toBe(409)
        expect(body.success).toBe(false)
        expect(body.error).toContain('Price List')
        expect(body.error).toContain('Tier-A')
    })

    it('should block delete when product has active Fabric Rolls', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: 'prod-roll' } as any)
        mockNoDependencies()
        prismaMock.fabricRoll.findFirst.mockResolvedValue({ rollNumber: 'R-2024-001' } as any)

        const response = await DELETE(makeRequest(), makeParams('prod-roll'))
        const body = await response.json()

        expect(response.status).toBe(409)
        expect(body.success).toBe(false)
        expect(body.error).toContain('fabric roll')
        expect(body.error).toContain('R-2024-001')
    })
})

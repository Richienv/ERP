import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prismaMock } from '../test-setup'

// The test-setup already mocks './lib/prisma' via setupFiles.
// Import the route handler - the mock is already active.
import { DELETE } from '../app/api/products/[id]/route'

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

    it('should hard-delete a product with zero dependencies', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
            id: 'prod-clean',
            name: 'Clean Product',
            _count: {
                stockLevels: 0,
                transactions: 0,
                quotationItems: 0,
                salesOrderItems: 0,
                purchaseOrderItems: 0,
                BOMItem: 0,
                workOrders: 0,
            },
        } as any)
        prismaMock.product.delete.mockResolvedValue({} as any)

        const response = await DELETE(makeRequest(), makeParams('prod-clean'))
        const body = await response.json()

        expect(body.success).toBe(true)
        expect(prismaMock.product.delete).toHaveBeenCalledWith({ where: { id: 'prod-clean' } })
        expect(prismaMock.product.update).not.toHaveBeenCalled()
    })

    it('should soft-delete (deactivate) a product with stock levels', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
            id: 'prod-stock',
            name: 'Stocked Product',
            _count: {
                stockLevels: 3,
                transactions: 0,
                quotationItems: 0,
                salesOrderItems: 0,
                purchaseOrderItems: 0,
                BOMItem: 0,
                workOrders: 0,
            },
        } as any)
        prismaMock.product.update.mockResolvedValue({} as any)

        const response = await DELETE(makeRequest(), makeParams('prod-stock'))
        const body = await response.json()

        expect(body.success).toBe(true)
        expect(body.message).toContain('dinonaktifkan')
        expect(prismaMock.product.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'prod-stock' },
                data: expect.objectContaining({ isActive: false }),
            })
        )
        expect(prismaMock.product.delete).not.toHaveBeenCalled()
    })

    it('should soft-delete a product referenced by sales orders', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
            id: 'prod-sales',
            name: 'Sales Product',
            _count: {
                stockLevels: 0,
                transactions: 0,
                quotationItems: 2,
                salesOrderItems: 5,
                purchaseOrderItems: 0,
                BOMItem: 0,
                workOrders: 0,
            },
        } as any)
        prismaMock.product.update.mockResolvedValue({} as any)

        const response = await DELETE(makeRequest(), makeParams('prod-sales'))
        const body = await response.json()

        expect(body.success).toBe(true)
        expect(body.message).toContain('penjualan')
        expect(prismaMock.product.delete).not.toHaveBeenCalled()
    })

    it('should soft-delete a product referenced by purchase orders', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
            id: 'prod-po',
            name: 'PO Product',
            _count: {
                stockLevels: 0,
                transactions: 0,
                quotationItems: 0,
                salesOrderItems: 0,
                purchaseOrderItems: 3,
                BOMItem: 0,
                workOrders: 0,
            },
        } as any)
        prismaMock.product.update.mockResolvedValue({} as any)

        const response = await DELETE(makeRequest(), makeParams('prod-po'))
        const body = await response.json()

        expect(body.success).toBe(true)
        expect(body.message).toContain('pengadaan')
        expect(prismaMock.product.delete).not.toHaveBeenCalled()
    })

    it('should soft-delete a product referenced by BOMs or work orders', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
            id: 'prod-mfg',
            name: 'Manufacturing Product',
            _count: {
                stockLevels: 0,
                transactions: 0,
                quotationItems: 0,
                salesOrderItems: 0,
                purchaseOrderItems: 0,
                BOMItem: 2,
                workOrders: 1,
            },
        } as any)
        prismaMock.product.update.mockResolvedValue({} as any)

        const response = await DELETE(makeRequest(), makeParams('prod-mfg'))
        const body = await response.json()

        expect(body.success).toBe(true)
        expect(body.message).toContain('manufaktur')
        expect(prismaMock.product.delete).not.toHaveBeenCalled()
    })

    it('should include multiple reasons when product has dependencies across modules', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
            id: 'prod-multi',
            name: 'Multi-Ref Product',
            _count: {
                stockLevels: 5,
                transactions: 10,
                quotationItems: 0,
                salesOrderItems: 3,
                purchaseOrderItems: 2,
                BOMItem: 0,
                workOrders: 0,
            },
        } as any)
        prismaMock.product.update.mockResolvedValue({} as any)

        const response = await DELETE(makeRequest(), makeParams('prod-multi'))
        const body = await response.json()

        expect(body.success).toBe(true)
        // Should mention multiple reasons
        expect(body.message).toContain('stok aktif')
        expect(body.message).toContain('riwayat pergerakan')
        expect(body.message).toContain('penjualan')
        expect(body.message).toContain('pengadaan')
    })
})

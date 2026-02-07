
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requestPurchase, getMaterialGapAnalysis } from './inventory'
import { prismaMock } from '../../test-setup'

// Increase timeout for db ops simulation
vi.setConfig({ testTimeout: 10000 })

describe('Inventory Actions', () => {

    // Test Data Helpers
    const mockProduct = {
        id: 'prod-1',
        name: 'Test Product',
        code: 'TEST-001',
        isActive: true, // Required by filter
        // ... extensive mock data to satisfy types ...
        stockLevels: [{ quantity: 10, warehouse: { id: 'w1', name: 'Main' } }],
        supplierItems: [{
            supplierId: 's1',
            leadTime: 7,
            price: 50000,
            isPreferred: true,
            supplier: { name: 'Vendor A' }
        }],
        purchaseOrderItems: [],
        BOMItem: [],
        workOrders: [],
        costPrice: 50000,
        manualBurnRate: 5,
        minStock: 20
        // Add other required fields as minimal/any
    } as any

    const mockEmployee = {
        id: 'emp-1',
        firstName: 'Richie',
        status: 'ACTIVE'
    } as any

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('requestPurchase', () => {
        it('should create a PENDING PurchaseRequest', async () => {
            // Arrange
            prismaMock.employee.findFirst.mockResolvedValue(mockEmployee)
            prismaMock.purchaseRequest.create.mockResolvedValue({
                id: 'pr-1',
                number: 'PR-202601-0001',
                status: 'PENDING'
            } as any)

            // Act
            const result = await requestPurchase({
                itemId: 'prod-1',
                quantity: 100
            })

            // Assert
            expect(result.success).toBe(true)
            expect(result.message).toContain('Purchase Request Created')
            expect(result.pendingTask).toEqual({ id: 'pr-1' })

            // Verify PurchaseRequest Creation
            expect(prismaMock.purchaseRequest.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    status: 'PENDING',
                    items: expect.objectContaining({
                        create: expect.objectContaining({
                            productId: 'prod-1',
                            quantity: 100
                        })
                    })
                })
            }))

            // Verify PO NOT created (no auto-order)
            expect(prismaMock.purchaseOrder.create).not.toHaveBeenCalled()
        })

        it('should fail gracefully when no employee found', async () => {
            // Arrange
            prismaMock.employee.findFirst.mockResolvedValue(null)

            // Act
            const result = await requestPurchase({
                itemId: 'prod-1',
                quantity: 100
            })

            // Assert
            expect(result.success).toBe(false)
            expect(result.error).toBeDefined()
        })
    })

    describe('getMaterialGapAnalysis', () => {
        it('should mark items with pending requests correctly', async () => {
            // Arrange
            prismaMock.product.findMany.mockResolvedValue([mockProduct])
            prismaMock.employeeTask.findMany.mockResolvedValue([
                { relatedId: 'prod-1' } as any
            ])

            // Act
            const result = await getMaterialGapAnalysis()

            // Assert
            expect(result[0].isPendingRequest).toBe(true)
            expect(result[0].id).toBe('prod-1')
        })

        it('should calculate Gap correctly', async () => {
            // Mock gap calculation logic input
            // Current Stock: 10
            // Burn: 5/day, Lead: 7 days => Demand over lead time = 35
            // Safety: 0 (default)
            // ROP logic in code: (Burn * Lead) + Safety = 35
            // Min Stock: 20
            // Reorder Point used = Max(35, 20) = 35
            // Gap = ROP - Stock = 35 - 10 = 25

            // Setup mock data for this scenario...
            // reusing mockProduct above which seems to fit
            // stockLevels sum = 10

            prismaMock.product.findMany.mockResolvedValue([mockProduct])
            prismaMock.employeeTask.findMany.mockResolvedValue([])

            const result = await getMaterialGapAnalysis()

            // Check
            expect(result[0].currentStock).toBe(10)
            expect(result[0].reorderPoint).toBe(35)
            expect(result[0].gap).toBeGreaterThan(0) // 35 - 10 = 25
        })
        it('should include Open POs when Gap exists', async () => {
            // Arrange
            const mockProductWithPO = {
                ...mockProduct,
                stockLevels: [{ quantity: 0, warehouse: { id: 'w1', name: 'Main' } }], // 0 stock -> Gap = 35
                purchaseOrderItems: [{
                    purchaseOrder: {
                        id: 'po-1',
                        number: 'PO-123',
                        expectedDate: new Date(),
                        status: 'OPEN',
                        supplier: { name: 'Vendor A' }
                    },
                    quantity: 40,
                    receivedQty: 0,
                    unitPrice: 50000
                }]
            }
            prismaMock.product.findMany.mockResolvedValue([mockProductWithPO])
            prismaMock.employeeTask.findMany.mockResolvedValue([])

            // Act
            const result = await getMaterialGapAnalysis()

            // Assert
            expect(result[0].gap).toBeGreaterThan(0) // 35 gap
            expect(result[0].openPOs).toHaveLength(1)
            expect(result[0].openPOs[0].number).toBe('PO-123')
            expect(result[0].activePO).not.toBeNull()
        })
        it('should correctly identify Open POs for "Receive Goods" state', async () => {
            // Scenario: Purchasing Team has created a PO (Status: OPEN)
            // The item should NO LONGER show "Request Purchase"
            // It SHOULD show "Receive Goods" (implied by having openPOs)

            // Arrange
            const mockProductWithOpenPO = {
                ...mockProduct,
                stockLevels: [{ quantity: 0, warehouse: { id: 'w1', name: 'Main' } }], // Gap exists
                purchaseOrderItems: [{
                    purchaseOrder: {
                        id: 'po-confirmed',
                        number: 'PO-CONFIRMED',
                        expectedDate: new Date(),
                        status: 'OPEN', // Critical: This status triggers the logic
                        supplier: { name: 'Vendor A' }
                    },
                    quantity: 40,
                    receivedQty: 0,
                    remainingQty: 40,
                    unitPrice: 50000
                }],
                // Ensure no pending task interferes (task should be completed or ignored if PO exists)
                // In reality, the task might still be there but COMPLETED.
                // Logic check: Does openPOs take precedence?
            }

            prismaMock.product.findMany.mockResolvedValue([mockProductWithOpenPO])
            prismaMock.employeeTask.findMany.mockResolvedValue([])

            // Act
            const result = await getMaterialGapAnalysis()

            // Assert
            const item = result[0]

            // 1. Must have Open POs
            expect(item.openPOs.length).toBeGreaterThan(0)
            expect(item.openPOs[0].number).toBe('PO-CONFIRMED')

            // 2. Must still report gap (so standard "All Good" doesn't hide it)
            expect(item.gap).toBeGreaterThan(0)

            // 3. activePO should be set (used for "Incoming" badge logic)
            expect(item.activePO).toBeTruthy()
        })
    })
})

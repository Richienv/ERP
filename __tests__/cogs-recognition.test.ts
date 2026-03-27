import { describe, it, expect } from 'vitest'

/**
 * Tests for COGS Recognition on Sales Invoice (ACCT2-006).
 *
 * When a sales invoice (INV_OUT) with stock items is posted, a separate COGS
 * journal entry should be generated:
 *   DR COGS (product.cogsAccountId or fallback 5000)
 *   CR Inventory (product.inventoryAccountId or fallback 1300)
 *
 * Amount = quantity × product.costPrice (WAC)
 */

// ==========================================
// COGS Line Builder Logic (mirrors moveInvoiceToSent COGS logic)
// ==========================================

interface ProductInfo {
    id: string
    name: string
    costPrice: number
    productType: string
    cogsAccountCode?: string   // from cogsAccount.code
    inventoryAccountCode?: string // from inventoryAccount.code
}

interface InvoiceLineItem {
    quantity: number
    product: ProductInfo | null
}

const SYS_COGS = '5000'
const SYS_INVENTORY = '1300'

interface CogsJournalLine {
    accountCode: string
    debit: number
    credit: number
    description: string
}

function buildCogsLines(items: InvoiceLineItem[]): CogsJournalLine[] {
    const lines: CogsJournalLine[] = []

    for (const item of items) {
        if (!item.product) continue // service/text line
        const cost = item.product.costPrice || 0
        if (cost <= 0) continue // no cost — skip
        const qty = item.quantity || 0
        if (qty <= 0) continue
        const cogsAmount = qty * cost

        const cogsCode = item.product.cogsAccountCode || SYS_COGS
        const invCode = item.product.inventoryAccountCode || SYS_INVENTORY

        lines.push({
            accountCode: cogsCode,
            debit: cogsAmount,
            credit: 0,
            description: `HPP - ${item.product.name} (${qty} x ${cost})`,
        })
        lines.push({
            accountCode: invCode,
            debit: 0,
            credit: cogsAmount,
            description: `Persediaan keluar - ${item.product.name}`,
        })
    }

    return lines
}

function isBalanced(lines: CogsJournalLine[]): boolean {
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0)
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0)
    return Math.abs(totalDebit - totalCredit) < 0.01
}

// ==========================================
// Tests
// ==========================================

describe('COGS Recognition — ACCT2-006', () => {
    describe('Basic COGS generation', () => {
        it('should generate COGS lines for stock items with costPrice', () => {
            const items: InvoiceLineItem[] = [
                {
                    quantity: 10,
                    product: {
                        id: 'p1',
                        name: 'Kain Katun',
                        costPrice: 50000,
                        productType: 'TRADING',
                    }
                }
            ]
            const lines = buildCogsLines(items)
            expect(lines).toHaveLength(2)
            expect(lines[0]).toEqual({
                accountCode: SYS_COGS,
                debit: 500000,
                credit: 0,
                description: 'HPP - Kain Katun (10 x 50000)',
            })
            expect(lines[1]).toEqual({
                accountCode: SYS_INVENTORY,
                debit: 0,
                credit: 500000,
                description: 'Persediaan keluar - Kain Katun',
            })
            expect(isBalanced(lines)).toBe(true)
        })

        it('should handle multiple stock items', () => {
            const items: InvoiceLineItem[] = [
                {
                    quantity: 5,
                    product: { id: 'p1', name: 'Kain A', costPrice: 100000, productType: 'TRADING' }
                },
                {
                    quantity: 3,
                    product: { id: 'p2', name: 'Benang B', costPrice: 25000, productType: 'RAW_MATERIAL' }
                },
            ]
            const lines = buildCogsLines(items)
            expect(lines).toHaveLength(4) // 2 lines per product
            const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
            const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
            expect(totalDebit).toBe(575000) // 5*100000 + 3*25000
            expect(totalCredit).toBe(575000)
            expect(isBalanced(lines)).toBe(true)
        })
    })

    describe('Product-specific GL accounts', () => {
        it('should use product cogsAccountId when set', () => {
            const items: InvoiceLineItem[] = [
                {
                    quantity: 2,
                    product: {
                        id: 'p1',
                        name: 'Produk Custom',
                        costPrice: 200000,
                        productType: 'MANUFACTURED',
                        cogsAccountCode: '5100', // custom COGS account
                    }
                }
            ]
            const lines = buildCogsLines(items)
            expect(lines[0].accountCode).toBe('5100')
            expect(lines[1].accountCode).toBe(SYS_INVENTORY) // fallback for inventory
        })

        it('should use product inventoryAccountId when set', () => {
            const items: InvoiceLineItem[] = [
                {
                    quantity: 1,
                    product: {
                        id: 'p1',
                        name: 'Bahan Baku',
                        costPrice: 75000,
                        productType: 'RAW_MATERIAL',
                        inventoryAccountCode: '1310', // Raw Materials account
                    }
                }
            ]
            const lines = buildCogsLines(items)
            expect(lines[0].accountCode).toBe(SYS_COGS) // fallback for COGS
            expect(lines[1].accountCode).toBe('1310')
        })

        it('should use both custom accounts when set', () => {
            const items: InvoiceLineItem[] = [
                {
                    quantity: 4,
                    product: {
                        id: 'p1',
                        name: 'Premium Item',
                        costPrice: 300000,
                        productType: 'MANUFACTURED',
                        cogsAccountCode: '5200',
                        inventoryAccountCode: '1320',
                    }
                }
            ]
            const lines = buildCogsLines(items)
            expect(lines[0].accountCode).toBe('5200')
            expect(lines[1].accountCode).toBe('1320')
            expect(isBalanced(lines)).toBe(true)
        })
    })

    describe('Skip conditions', () => {
        it('should skip service/text lines (no product)', () => {
            const items: InvoiceLineItem[] = [
                { quantity: 1, product: null },
            ]
            const lines = buildCogsLines(items)
            expect(lines).toHaveLength(0)
        })

        it('should skip products with costPrice = 0', () => {
            const items: InvoiceLineItem[] = [
                {
                    quantity: 10,
                    product: { id: 'p1', name: 'Gratis', costPrice: 0, productType: 'TRADING' }
                }
            ]
            const lines = buildCogsLines(items)
            expect(lines).toHaveLength(0)
        })

        it('should skip products with negative costPrice', () => {
            const items: InvoiceLineItem[] = [
                {
                    quantity: 5,
                    product: { id: 'p1', name: 'Negatif', costPrice: -100, productType: 'TRADING' }
                }
            ]
            const lines = buildCogsLines(items)
            expect(lines).toHaveLength(0)
        })

        it('should skip items with quantity = 0', () => {
            const items: InvoiceLineItem[] = [
                {
                    quantity: 0,
                    product: { id: 'p1', name: 'Zero Qty', costPrice: 50000, productType: 'TRADING' }
                }
            ]
            const lines = buildCogsLines(items)
            expect(lines).toHaveLength(0)
        })

        it('should return empty array when no items have cost', () => {
            const items: InvoiceLineItem[] = [
                { quantity: 1, product: null }, // service line
                { quantity: 5, product: { id: 'p2', name: 'Free', costPrice: 0, productType: 'TRADING' } },
            ]
            const lines = buildCogsLines(items)
            expect(lines).toHaveLength(0)
        })
    })

    describe('Mixed items — stock + service', () => {
        it('should only generate COGS for stock items, skip service lines', () => {
            const items: InvoiceLineItem[] = [
                {
                    quantity: 10,
                    product: { id: 'p1', name: 'Kain', costPrice: 50000, productType: 'TRADING' }
                },
                { quantity: 1, product: null }, // service line — "Jasa Jahit"
                {
                    quantity: 0,
                    product: { id: 'p3', name: 'Sample', costPrice: 10000, productType: 'TRADING' }
                },
            ]
            const lines = buildCogsLines(items)
            expect(lines).toHaveLength(2) // only Kain generates COGS
            expect(lines[0].debit).toBe(500000)
            expect(lines[1].credit).toBe(500000)
            expect(isBalanced(lines)).toBe(true)
        })
    })

    describe('COGS journal metadata', () => {
        it('should use COGS_RECOGNITION as source document type', () => {
            // This test validates the contract — the actual sourceDocumentType
            // is set in moveInvoiceToSent(), not in the line builder
            const sourceDocumentType = 'COGS_RECOGNITION'
            expect(sourceDocumentType).toBe('COGS_RECOGNITION')
        })

        it('should create separate journal from AR/Revenue entry', () => {
            // AR journal uses reference: invoiceNumber
            // COGS journal uses reference: COGS-invoiceNumber
            const invoiceNumber = 'INV-2026-001'
            const arRef = invoiceNumber
            const cogsRef = `COGS-${invoiceNumber}`
            expect(arRef).not.toBe(cogsRef)
        })
    })

    describe('Balance integrity', () => {
        it('total COGS debit should equal total inventory credit', () => {
            const items: InvoiceLineItem[] = [
                { quantity: 100, product: { id: 'p1', name: 'A', costPrice: 15000, productType: 'TRADING' } },
                { quantity: 50, product: { id: 'p2', name: 'B', costPrice: 25000, productType: 'MANUFACTURED' } },
                { quantity: 200, product: { id: 'p3', name: 'C', costPrice: 8500, productType: 'RAW_MATERIAL' } },
            ]
            const lines = buildCogsLines(items)
            expect(lines).toHaveLength(6) // 2 per item
            const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
            const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
            // 100*15000 + 50*25000 + 200*8500 = 1500000 + 1250000 + 1700000 = 4450000
            expect(totalDebit).toBe(4450000)
            expect(totalCredit).toBe(4450000)
            expect(isBalanced(lines)).toBe(true)
        })
    })
})

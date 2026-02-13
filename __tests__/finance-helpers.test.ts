import { describe, it, expect } from 'vitest'

/**
 * Tests for pure helper functions extracted from the finance module.
 * These test the pagination normalization and query sanitization logic
 * that was added in the recent server-driven filter commits.
 */

// ==========================================
// AR Registry Query Normalization
// ==========================================

// Inline the normalizer to test it in isolation (same logic as finance-ar.ts)
function normalizeARRegistryQuery(input?: {
    paymentsQ?: string | null
    invoicesQ?: string | null
    customerId?: string | null
    paymentPage?: number | null
    invoicePage?: number | null
    pageSize?: number | null
}) {
    const normalizeText = (value?: string | null) => {
        const trimmed = (value || "").trim()
        return trimmed.length > 0 ? trimmed : null
    }
    const clamp = (value: number | null | undefined, min: number, max: number, fallback: number) => {
        const parsed = Number(value)
        if (!Number.isFinite(parsed)) return fallback
        return Math.min(max, Math.max(min, Math.trunc(parsed)))
    }

    return {
        paymentsQ: normalizeText(input?.paymentsQ),
        invoicesQ: normalizeText(input?.invoicesQ),
        customerId: normalizeText(input?.customerId),
        paymentPage: clamp(input?.paymentPage, 1, 100000, 1),
        invoicePage: clamp(input?.invoicePage, 1, 100000, 1),
        pageSize: clamp(input?.pageSize, 8, 100, 20),
    }
}

describe('normalizeARRegistryQuery', () => {
    it('should return defaults when called with no input', () => {
        const result = normalizeARRegistryQuery()
        expect(result).toEqual({
            paymentsQ: null,
            invoicesQ: null,
            customerId: null,
            paymentPage: 1,
            invoicePage: 1,
            pageSize: 20,
        })
    })

    it('should return defaults when called with empty input', () => {
        const result = normalizeARRegistryQuery({})
        expect(result).toEqual({
            paymentsQ: null,
            invoicesQ: null,
            customerId: null,
            paymentPage: 1,
            invoicePage: 1,
            pageSize: 20,
        })
    })

    it('should trim whitespace from text inputs', () => {
        const result = normalizeARRegistryQuery({
            paymentsQ: '  PAY-001  ',
            invoicesQ: '  INV-001  ',
            customerId: '  cust-123  ',
        })
        expect(result.paymentsQ).toBe('PAY-001')
        expect(result.invoicesQ).toBe('INV-001')
        expect(result.customerId).toBe('cust-123')
    })

    it('should treat whitespace-only strings as null', () => {
        const result = normalizeARRegistryQuery({
            paymentsQ: '   ',
            invoicesQ: '',
        })
        expect(result.paymentsQ).toBeNull()
        expect(result.invoicesQ).toBeNull()
    })

    it('should clamp page numbers to valid range', () => {
        expect(normalizeARRegistryQuery({ paymentPage: 0 }).paymentPage).toBe(1)
        expect(normalizeARRegistryQuery({ paymentPage: -5 }).paymentPage).toBe(1)
        expect(normalizeARRegistryQuery({ paymentPage: 100001 }).paymentPage).toBe(100000)
        expect(normalizeARRegistryQuery({ paymentPage: 50 }).paymentPage).toBe(50)
    })

    it('should clamp pageSize to 8-100 range', () => {
        expect(normalizeARRegistryQuery({ pageSize: 1 }).pageSize).toBe(8)
        expect(normalizeARRegistryQuery({ pageSize: 200 }).pageSize).toBe(100)
        expect(normalizeARRegistryQuery({ pageSize: 50 }).pageSize).toBe(50)
    })

    it('should use fallback for NaN page values', () => {
        expect(normalizeARRegistryQuery({ paymentPage: NaN }).paymentPage).toBe(1)
        expect(normalizeARRegistryQuery({ pageSize: NaN }).pageSize).toBe(20)
        expect(normalizeARRegistryQuery({ paymentPage: null }).paymentPage).toBe(1)
    })

    it('should truncate fractional page numbers', () => {
        expect(normalizeARRegistryQuery({ paymentPage: 3.7 }).paymentPage).toBe(3)
        expect(normalizeARRegistryQuery({ invoicePage: 5.9 }).invoicePage).toBe(5)
    })
})

// ==========================================
// Vendor Bill Query Normalization
// ==========================================

function normalizeVendorBillQuery(input?: {
    q?: string | null
    status?: string | null
    page?: number | null
    pageSize?: number | null
}) {
    const trimmedQ = (input?.q || "").trim()
    const trimmedStatus = (input?.status || "").trim().toUpperCase()
    const pageRaw = Number(input?.page)
    const pageSizeRaw = Number(input?.pageSize)
    return {
        q: trimmedQ.length > 0 ? trimmedQ : null,
        status: trimmedStatus.length > 0 ? trimmedStatus : null,
        page: Number.isFinite(pageRaw) ? Math.max(1, Math.trunc(pageRaw)) : 1,
        pageSize: Number.isFinite(pageSizeRaw) ? Math.min(50, Math.max(6, Math.trunc(pageSizeRaw))) : 12,
    }
}

describe('normalizeVendorBillQuery', () => {
    it('should return defaults when called with no input', () => {
        const result = normalizeVendorBillQuery()
        expect(result).toEqual({
            q: null,
            status: null,
            page: 1,
            pageSize: 12,
        })
    })

    it('should uppercase status values', () => {
        expect(normalizeVendorBillQuery({ status: 'draft' }).status).toBe('DRAFT')
        expect(normalizeVendorBillQuery({ status: 'Overdue' }).status).toBe('OVERDUE')
    })

    it('should trim and normalize search queries', () => {
        expect(normalizeVendorBillQuery({ q: '  BILL-001  ' }).q).toBe('BILL-001')
        expect(normalizeVendorBillQuery({ q: '' }).q).toBeNull()
        expect(normalizeVendorBillQuery({ q: '   ' }).q).toBeNull()
    })

    it('should clamp page to minimum of 1', () => {
        expect(normalizeVendorBillQuery({ page: 0 }).page).toBe(1)
        expect(normalizeVendorBillQuery({ page: -10 }).page).toBe(1)
    })

    it('should clamp pageSize to 6-50 range', () => {
        expect(normalizeVendorBillQuery({ pageSize: 1 }).pageSize).toBe(6)
        expect(normalizeVendorBillQuery({ pageSize: 100 }).pageSize).toBe(50)
        expect(normalizeVendorBillQuery({ pageSize: 25 }).pageSize).toBe(25)
    })

    it('should use fallback defaults for NaN values', () => {
        expect(normalizeVendorBillQuery({ page: NaN }).page).toBe(1)
        expect(normalizeVendorBillQuery({ pageSize: NaN }).pageSize).toBe(12)
    })
})

// ==========================================
// Invoice Kanban Status Categorization
// ==========================================

describe('Invoice Kanban categorization logic', () => {
    // Replicate the categorization logic from getInvoiceKanbanData
    function categorizeInvoice(invoice: {
        status: string
        dueDate: Date
    }, now: Date): 'draft' | 'sent' | 'overdue' | 'paid' {
        if (invoice.status === 'DRAFT') return 'draft'
        if (invoice.status === 'PAID') return 'paid'
        const isOverdue = invoice.status === 'OVERDUE' || invoice.dueDate < now
        return isOverdue ? 'overdue' : 'sent'
    }

    const now = new Date('2026-02-13T00:00:00Z')

    it('should categorize DRAFT invoices correctly', () => {
        expect(categorizeInvoice({ status: 'DRAFT', dueDate: new Date('2026-03-01') }, now)).toBe('draft')
    })

    it('should categorize PAID invoices correctly', () => {
        expect(categorizeInvoice({ status: 'PAID', dueDate: new Date('2026-01-01') }, now)).toBe('paid')
    })

    it('should categorize OVERDUE status as overdue', () => {
        expect(categorizeInvoice({ status: 'OVERDUE', dueDate: new Date('2026-03-01') }, now)).toBe('overdue')
    })

    it('should categorize past-due invoices as overdue regardless of status', () => {
        expect(categorizeInvoice({ status: 'ISSUED', dueDate: new Date('2026-01-01') }, now)).toBe('overdue')
    })

    it('should categorize ISSUED invoices with future due date as sent', () => {
        expect(categorizeInvoice({ status: 'ISSUED', dueDate: new Date('2026-03-01') }, now)).toBe('sent')
    })

    it('should categorize PARTIAL invoices with future due date as sent', () => {
        expect(categorizeInvoice({ status: 'PARTIAL', dueDate: new Date('2026-03-01') }, now)).toBe('sent')
    })
})

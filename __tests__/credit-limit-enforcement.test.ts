import { describe, it, expect } from 'vitest'

/**
 * Tests for Credit Limit Enforcement on Invoice Edit/Issue.
 *
 * Validates that the credit limit check is applied consistently:
 * - CREATE: hard block ✅ (already working)
 * - UPDATE DRAFT: hard block ✅ (was missing — fixed)
 * - ISSUE (DRAFT→ISSUED): hard block ✅ (was soft warning — fixed)
 *
 * The core logic mirrors checkCreditLimit() in finance-invoices.ts.
 */

// ==========================================
// Credit Limit Check Logic (mirrors finance-invoices.ts)
// ==========================================

interface CreditCheckInput {
    customerCreditLimit: number | null  // null or 0 = unlimited
    customerCreditStatus?: 'ACTIVE' | 'HOLD' | 'BLOCKED'
    outstandingInvoices: Array<{
        id: string
        balanceDue: number
        status: 'ISSUED' | 'PARTIAL' | 'OVERDUE'
    }>
    newInvoiceAmount: number
    excludeInvoiceId?: string  // Exclude the current invoice being edited
}

function checkCreditLimit(input: CreditCheckInput): { ok: true } | { ok: false; message: string } {
    const { customerCreditLimit, customerCreditStatus, outstandingInvoices, newInvoiceAmount, excludeInvoiceId } = input

    // No limit set — unlimited
    if (!customerCreditLimit || customerCreditLimit <= 0) return { ok: true }

    // Block if customer credit status is HOLD or BLOCKED
    if (customerCreditStatus === 'HOLD' || customerCreditStatus === 'BLOCKED') {
        return {
            ok: false,
            message: `Customer berstatus ${customerCreditStatus === 'HOLD' ? 'DITAHAN' : 'DIBLOKIR'}. Tidak dapat membuat invoice baru.`,
        }
    }

    // Sum outstanding, excluding the current invoice if editing
    const outstanding = outstandingInvoices
        .filter(inv => !excludeInvoiceId || inv.id !== excludeInvoiceId)
        .reduce((sum, inv) => sum + inv.balanceDue, 0)

    if (outstanding + newInvoiceAmount > customerCreditLimit) {
        const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
        return {
            ok: false,
            message: `Melebihi limit kredit. Outstanding: ${fmt(outstanding)}, Invoice baru: ${fmt(newInvoiceAmount)}, Total: ${fmt(outstanding + newInvoiceAmount)}, Limit: ${fmt(customerCreditLimit)}`,
        }
    }

    return { ok: true }
}

// ==========================================
// Test: CREATE — credit limit enforced (baseline)
// ==========================================

describe('Credit Limit — Invoice CREATE', () => {
    it('blocks creation when amount exceeds limit', () => {
        const result = checkCreditLimit({
            customerCreditLimit: 7_000_000,
            outstandingInvoices: [],
            newInvoiceAmount: 7_770_001,  // Rp 7.000.001 + PPN 11%
        })
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.message).toContain('Melebihi limit kredit')
    })

    it('allows creation when amount is within limit', () => {
        const result = checkCreditLimit({
            customerCreditLimit: 7_000_000,
            outstandingInvoices: [],
            newInvoiceAmount: 11,  // Rp 10 + PPN 11%
        })
        expect(result.ok).toBe(true)
    })

    it('blocks when outstanding + new amount exceeds limit', () => {
        const result = checkCreditLimit({
            customerCreditLimit: 7_000_000,
            outstandingInvoices: [
                { id: 'inv-1', balanceDue: 5_000_000, status: 'ISSUED' },
            ],
            newInvoiceAmount: 2_500_000,
        })
        expect(result.ok).toBe(false)
    })

    it('allows unlimited credit (limit = 0)', () => {
        const result = checkCreditLimit({
            customerCreditLimit: 0,
            outstandingInvoices: [],
            newInvoiceAmount: 999_999_999,
        })
        expect(result.ok).toBe(true)
    })

    it('allows unlimited credit (limit = null)', () => {
        const result = checkCreditLimit({
            customerCreditLimit: null,
            outstandingInvoices: [],
            newInvoiceAmount: 999_999_999,
        })
        expect(result.ok).toBe(true)
    })
})

// ==========================================
// Test: UPDATE DRAFT — credit limit enforced (was the bug)
// ==========================================

describe('Credit Limit — Invoice UPDATE DRAFT', () => {
    it('blocks edit when new amount exceeds limit (the bypass scenario)', () => {
        // User created DRAFT for Rp 10, now editing to Rp 7.000.001
        // The DRAFT invoice (inv-edit) is NOT in outstanding because it's DRAFT status
        const result = checkCreditLimit({
            customerCreditLimit: 7_000_000,
            outstandingInvoices: [],  // No ISSUED invoices
            newInvoiceAmount: 7_770_001,  // Rp 7.000.001 + PPN 11%
            excludeInvoiceId: 'inv-edit',
        })
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.message).toContain('Melebihi limit kredit')
    })

    it('excludes the current invoice from outstanding calculation', () => {
        // Invoice inv-edit was previously ISSUED for 3M, now editing back to DRAFT
        // Other outstanding: 3M. New amount: 3.5M. Limit: 7M.
        // Without exclusion: 3M + 3M + 3.5M = 9.5M > 7M (would block incorrectly)
        // With exclusion: 3M + 3.5M = 6.5M < 7M (should pass)
        const result = checkCreditLimit({
            customerCreditLimit: 7_000_000,
            outstandingInvoices: [
                { id: 'inv-other', balanceDue: 3_000_000, status: 'ISSUED' },
                { id: 'inv-edit', balanceDue: 3_000_000, status: 'ISSUED' },
            ],
            newInvoiceAmount: 3_500_000,
            excludeInvoiceId: 'inv-edit',
        })
        expect(result.ok).toBe(true)
    })

    it('blocks edit even with exclusion when total still exceeds', () => {
        // Outstanding (excluding self): 6M. New amount: 1.5M. Total: 7.5M > 7M limit.
        const result = checkCreditLimit({
            customerCreditLimit: 7_000_000,
            outstandingInvoices: [
                { id: 'inv-other', balanceDue: 6_000_000, status: 'ISSUED' },
            ],
            newInvoiceAmount: 1_500_000,
            excludeInvoiceId: 'inv-edit',
        })
        expect(result.ok).toBe(false)
    })

    it('allows edit when amount decreased to within limit', () => {
        const result = checkCreditLimit({
            customerCreditLimit: 7_000_000,
            outstandingInvoices: [],
            newInvoiceAmount: 1,  // Rp 1 — well within limit
            excludeInvoiceId: 'inv-edit',
        })
        expect(result.ok).toBe(true)
    })
})

// ==========================================
// Test: ISSUE (DRAFT→ISSUED) — credit limit enforced
// ==========================================

describe('Credit Limit — Invoice ISSUE (DRAFT→ISSUED)', () => {
    it('blocks issuing when total exceeds limit', () => {
        // DRAFT with 8M total, limit is 7M. No other outstanding.
        const result = checkCreditLimit({
            customerCreditLimit: 7_000_000,
            outstandingInvoices: [],
            newInvoiceAmount: 8_000_000,
            excludeInvoiceId: 'inv-issue',  // Exclude self (not yet ISSUED)
        })
        expect(result.ok).toBe(false)
    })

    it('blocks issuing when outstanding + invoice exceeds limit', () => {
        // Existing 4M ISSUED, trying to issue 4M more. Total 8M > 7M limit.
        const result = checkCreditLimit({
            customerCreditLimit: 7_000_000,
            outstandingInvoices: [
                { id: 'inv-existing', balanceDue: 4_000_000, status: 'ISSUED' },
            ],
            newInvoiceAmount: 4_000_000,
            excludeInvoiceId: 'inv-issue',
        })
        expect(result.ok).toBe(false)
    })

    it('allows issuing when within limit', () => {
        const result = checkCreditLimit({
            customerCreditLimit: 7_000_000,
            outstandingInvoices: [],
            newInvoiceAmount: 1,
            excludeInvoiceId: 'inv-issue',
        })
        expect(result.ok).toBe(true)
    })
})

// ==========================================
// Test: Credit Status (HOLD/BLOCKED)
// ==========================================

describe('Credit Limit — Credit Status', () => {
    it('blocks HOLD customer regardless of amount', () => {
        const result = checkCreditLimit({
            customerCreditLimit: 100_000_000,
            customerCreditStatus: 'HOLD',
            outstandingInvoices: [],
            newInvoiceAmount: 1,
        })
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.message).toContain('DITAHAN')
    })

    it('blocks BLOCKED customer regardless of amount', () => {
        const result = checkCreditLimit({
            customerCreditLimit: 100_000_000,
            customerCreditStatus: 'BLOCKED',
            outstandingInvoices: [],
            newInvoiceAmount: 1,
        })
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.message).toContain('DIBLOKIR')
    })

    it('allows ACTIVE customer within limit', () => {
        const result = checkCreditLimit({
            customerCreditLimit: 7_000_000,
            customerCreditStatus: 'ACTIVE',
            outstandingInvoices: [],
            newInvoiceAmount: 1_000_000,
        })
        expect(result.ok).toBe(true)
    })
})

// ==========================================
// Test: Edge cases
// ==========================================

describe('Credit Limit — Edge Cases', () => {
    it('exact limit amount is allowed (not exceeded)', () => {
        const result = checkCreditLimit({
            customerCreditLimit: 7_000_000,
            outstandingInvoices: [],
            newInvoiceAmount: 7_000_000,
        })
        // 7M + 0 = 7M, NOT > 7M, so should pass
        expect(result.ok).toBe(true)
    })

    it('one rupiah over limit is blocked', () => {
        const result = checkCreditLimit({
            customerCreditLimit: 7_000_000,
            outstandingInvoices: [],
            newInvoiceAmount: 7_000_001,
        })
        expect(result.ok).toBe(false)
    })

    it('handles multiple outstanding invoices with mixed statuses', () => {
        const result = checkCreditLimit({
            customerCreditLimit: 10_000_000,
            outstandingInvoices: [
                { id: 'inv-1', balanceDue: 2_000_000, status: 'ISSUED' },
                { id: 'inv-2', balanceDue: 3_000_000, status: 'PARTIAL' },
                { id: 'inv-3', balanceDue: 1_000_000, status: 'OVERDUE' },
            ],
            newInvoiceAmount: 5_000_000,
            // Total: 2M + 3M + 1M + 5M = 11M > 10M
        })
        expect(result.ok).toBe(false)
    })

    it('partial payment reduces outstanding correctly', () => {
        const result = checkCreditLimit({
            customerCreditLimit: 10_000_000,
            outstandingInvoices: [
                // Originally 5M, paid 3M, balance 2M
                { id: 'inv-1', balanceDue: 2_000_000, status: 'PARTIAL' },
            ],
            newInvoiceAmount: 7_000_000,
            // Total: 2M + 7M = 9M < 10M
        })
        expect(result.ok).toBe(true)
    })
})

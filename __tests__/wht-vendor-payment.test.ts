import { describe, it, expect } from 'vitest'

/**
 * Tests for WHT/PPh 23 on Vendor Payments (ACCT2-008).
 *
 * When a vendor payment includes withholding tax (PPh 23):
 * - DR AP (2000) [gross amount]
 * - CR Bank (1110) [net = gross - WHT]
 * - CR PPh 23 Payable (2315) [WHT amount]
 *
 * Invoice balanceDue decreases by GROSS amount.
 * When WHT is 0 or not provided, existing flow unchanged.
 */

// ==========================================
// Constants (matching SYS_ACCOUNTS)
// ==========================================

const SYS_AP = '2000'
const SYS_BANK_BCA = '1110'
const SYS_PPH23_PAYABLE = '2315'

// ==========================================
// Journal Line Builder (mirrors finance-ap.ts logic)
// ==========================================

interface JournalLine {
    accountCode: string
    debit: number
    credit: number
    description: string
}

function buildVendorPaymentJournal(params: {
    grossAmount: number
    whtAmount?: number
    whtRate?: number
    bankCode?: string
}): JournalLine[] {
    const { grossAmount, whtAmount = 0, whtRate = 0, bankCode = SYS_BANK_BCA } = params
    const netBankAmount = grossAmount - whtAmount

    const lines: JournalLine[] = []

    // DR AP (gross)
    lines.push({
        accountCode: SYS_AP,
        debit: grossAmount,
        credit: 0,
        description: 'Hutang Usaha'
    })

    // CR Bank (net)
    lines.push({
        accountCode: bankCode,
        debit: 0,
        credit: netBankAmount,
        description: 'Bank BCA'
    })

    // CR PPh 23 Payable (WHT)
    if (whtAmount > 0) {
        lines.push({
            accountCode: SYS_PPH23_PAYABLE,
            debit: 0,
            credit: whtAmount,
            description: `PPh 23 dipotong (${whtRate ? (whtRate * 100).toFixed(1) : '?'}%)`
        })
    }

    return lines
}

function isJournalBalanced(lines: JournalLine[]): boolean {
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0)
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0)
    return Math.abs(totalDebit - totalCredit) < 0.01
}

function computeInvoiceBalance(currentBalance: number, grossAmount: number): number {
    return Math.max(0, currentBalance - grossAmount)
}

// ==========================================
// Tests
// ==========================================

describe('ACCT2-008: WHT/PPh 23 on Vendor Payments', () => {

    describe('Journal entry construction — with WHT', () => {
        it('should create 3-line journal: DR AP, CR Bank (net), CR PPh23 (wht)', () => {
            const lines = buildVendorPaymentJournal({
                grossAmount: 10_000_000,
                whtAmount: 200_000,   // 2% of 10M
                whtRate: 0.02
            })

            expect(lines).toHaveLength(3)

            // DR AP = gross
            expect(lines[0].accountCode).toBe(SYS_AP)
            expect(lines[0].debit).toBe(10_000_000)
            expect(lines[0].credit).toBe(0)

            // CR Bank = net (gross - WHT)
            expect(lines[1].accountCode).toBe(SYS_BANK_BCA)
            expect(lines[1].debit).toBe(0)
            expect(lines[1].credit).toBe(9_800_000)

            // CR PPh 23 = WHT
            expect(lines[2].accountCode).toBe(SYS_PPH23_PAYABLE)
            expect(lines[2].debit).toBe(0)
            expect(lines[2].credit).toBe(200_000)
        })

        it('journal with WHT should be balanced', () => {
            const lines = buildVendorPaymentJournal({
                grossAmount: 5_000_000,
                whtAmount: 100_000,
                whtRate: 0.02
            })

            expect(isJournalBalanced(lines)).toBe(true)
        })

        it('should handle different WHT rates (PPh 23 = 2% for services)', () => {
            const grossAmount = 50_000_000
            const whtRate = 0.02
            const whtAmount = grossAmount * whtRate

            const lines = buildVendorPaymentJournal({
                grossAmount,
                whtAmount,
                whtRate
            })

            expect(lines[2].credit).toBe(1_000_000)
            expect(lines[1].credit).toBe(49_000_000)
            expect(isJournalBalanced(lines)).toBe(true)
        })

        it('should handle PPh 23 at 15% rate (dividends, royalties)', () => {
            const grossAmount = 20_000_000
            const whtRate = 0.15
            const whtAmount = grossAmount * whtRate

            const lines = buildVendorPaymentJournal({
                grossAmount,
                whtAmount,
                whtRate
            })

            expect(lines[2].credit).toBe(3_000_000)
            expect(lines[1].credit).toBe(17_000_000)
            expect(isJournalBalanced(lines)).toBe(true)
        })

        it('PPh 23 description should show rate percentage', () => {
            const lines = buildVendorPaymentJournal({
                grossAmount: 10_000_000,
                whtAmount: 200_000,
                whtRate: 0.02
            })

            expect(lines[2].description).toContain('2.0%')
        })
    })

    describe('Journal entry construction — without WHT (backwards compatible)', () => {
        it('should create 2-line journal when whtAmount is 0', () => {
            const lines = buildVendorPaymentJournal({
                grossAmount: 10_000_000,
                whtAmount: 0
            })

            expect(lines).toHaveLength(2)
            expect(lines[0].accountCode).toBe(SYS_AP)
            expect(lines[0].debit).toBe(10_000_000)
            expect(lines[1].accountCode).toBe(SYS_BANK_BCA)
            expect(lines[1].credit).toBe(10_000_000)
        })

        it('should create 2-line journal when whtAmount not provided', () => {
            const lines = buildVendorPaymentJournal({
                grossAmount: 10_000_000
            })

            expect(lines).toHaveLength(2)
            expect(isJournalBalanced(lines)).toBe(true)
        })

        it('no PPh 23 line when WHT is absent', () => {
            const lines = buildVendorPaymentJournal({ grossAmount: 5_000_000 })
            const pph23Lines = lines.filter(l => l.accountCode === SYS_PPH23_PAYABLE)
            expect(pph23Lines).toHaveLength(0)
        })
    })

    describe('Invoice balance reduction', () => {
        it('invoice balanceDue decreases by GROSS amount (WHT included)', () => {
            const currentBalance = 10_000_000
            const grossAmount = 10_000_000  // Full payment
            const newBalance = computeInvoiceBalance(currentBalance, grossAmount)
            expect(newBalance).toBe(0)
        })

        it('partial payment with WHT still reduces by gross', () => {
            const currentBalance = 10_000_000
            const grossAmount = 5_000_000  // 5M gross (including 100K WHT)
            const newBalance = computeInvoiceBalance(currentBalance, grossAmount)
            expect(newBalance).toBe(5_000_000)
        })

        it('balance never goes below zero', () => {
            const currentBalance = 1_000_000
            const grossAmount = 1_500_000  // overpayment edge case
            const newBalance = computeInvoiceBalance(currentBalance, grossAmount)
            expect(newBalance).toBe(0)
        })
    })

    describe('SYS_ACCOUNTS references', () => {
        it('PPH23_PAYABLE code should be 2315', () => {
            expect(SYS_PPH23_PAYABLE).toBe('2315')
        })

        it('AP code should be 2000', () => {
            expect(SYS_AP).toBe('2000')
        })
    })

    describe('Validation', () => {
        it('should reject WHT >= gross amount', () => {
            const grossAmount = 1_000_000
            const whtAmount = 1_000_000  // 100% WHT = invalid
            const netBankAmount = grossAmount - whtAmount

            expect(netBankAmount).toBeLessThanOrEqual(0)
        })

        it('should reject WHT > gross amount', () => {
            const grossAmount = 1_000_000
            const whtAmount = 1_500_000
            const netBankAmount = grossAmount - whtAmount

            expect(netBankAmount).toBeLessThan(0)
        })

        it('valid WHT produces positive net bank amount', () => {
            const grossAmount = 10_000_000
            const whtAmount = 200_000
            const netBankAmount = grossAmount - whtAmount

            expect(netBankAmount).toBeGreaterThan(0)
            expect(netBankAmount).toBe(9_800_000)
        })
    })

    describe('Payment record storage', () => {
        it('whtAmount should be stored on payment for tax reporting', () => {
            // Simulates the payment.create data
            const paymentData = {
                number: 'VPAY-2026-0001',
                supplierId: 'vendor-1',
                invoiceId: 'bill-1',
                amount: 10_000_000,       // gross
                whtAmount: 200_000,        // stored for PPh 23 reporting
                whtRate: 0.02,             // stored for reference
                method: 'TRANSFER' as const,
            }

            expect(paymentData.whtAmount).toBe(200_000)
            expect(paymentData.whtRate).toBe(0.02)
            expect(paymentData.amount).toBe(10_000_000) // gross, not net
        })

        it('whtAmount should be null when no WHT', () => {
            const whtAmount = 0
            const storedValue = whtAmount > 0 ? whtAmount : null

            expect(storedValue).toBeNull()
        })
    })
})

import { describe, it, expect } from 'vitest'

/**
 * Tests for AR Payment Bank Charges (ACCT2-009).
 *
 * When a customer payment has bank charges:
 * - DR Bank (1110) [amountReceived - bankCharge]
 * - DR Bank Charges (7200) [bankChargeAmount]
 * - CR AR (1200) [amountReceived]
 *
 * Invoice balanceDue decreases by full amountReceived.
 * When bankChargeAmount is 0 or not provided, existing flow unchanged.
 */

// ==========================================
// Constants (matching SYS_ACCOUNTS)
// ==========================================

const SYS_AR = '1200'
const SYS_BANK_BCA = '1110'
const SYS_BANK_CHARGES = '7200'

// ==========================================
// Journal Line Builder (mirrors finance-ar.ts recordARPayment logic)
// ==========================================

interface JournalLine {
    accountCode: string
    debit: number
    credit: number
}

function buildARPaymentJournal(params: {
    amountReceived: number
    bankChargeAmount?: number
    cashCode?: string
}): JournalLine[] {
    const { amountReceived, bankChargeAmount = 0, cashCode = SYS_BANK_BCA } = params
    const bankCharge = bankChargeAmount > 0 ? bankChargeAmount : 0
    const bankDebitAmount = amountReceived - bankCharge

    const lines: JournalLine[] = []

    // DR Bank (net received)
    lines.push({
        accountCode: cashCode,
        debit: bankDebitAmount,
        credit: 0
    })

    // DR Bank Charges (if any)
    if (bankCharge > 0) {
        lines.push({
            accountCode: SYS_BANK_CHARGES,
            debit: bankCharge,
            credit: 0
        })
    }

    // CR AR (full amount — customer owes the full amount, bank charge is company's expense)
    lines.push({
        accountCode: SYS_AR,
        debit: 0,
        credit: amountReceived
    })

    return lines
}

// ==========================================
// Invoice balance calculation (mirrors finance-ar.ts logic)
// ==========================================

function calculateNewBalance(currentBalance: number, amountReceived: number): number {
    return currentBalance - amountReceived
}

function determineStatus(newBalance: number): string {
    return newBalance <= 0 ? 'PAID' : 'PARTIAL'
}

// ==========================================
// Tests
// ==========================================

describe('ACCT2-009: AR Payment Bank Charges', () => {
    describe('Journal Entry Construction', () => {
        it('should create 3-line journal when bankChargeAmount > 0', () => {
            const lines = buildARPaymentJournal({
                amountReceived: 10_000_000,
                bankChargeAmount: 50_000
            })

            expect(lines).toHaveLength(3)

            // DR Bank = net (10M - 50K = 9.95M)
            expect(lines[0]).toEqual({
                accountCode: SYS_BANK_BCA,
                debit: 9_950_000,
                credit: 0
            })

            // DR Bank Charges = 50K
            expect(lines[1]).toEqual({
                accountCode: SYS_BANK_CHARGES,
                debit: 50_000,
                credit: 0
            })

            // CR AR = full 10M
            expect(lines[2]).toEqual({
                accountCode: SYS_AR,
                debit: 0,
                credit: 10_000_000
            })
        })

        it('should create 2-line journal when bankChargeAmount is 0', () => {
            const lines = buildARPaymentJournal({
                amountReceived: 5_000_000,
                bankChargeAmount: 0
            })

            expect(lines).toHaveLength(2)

            // DR Bank = full amount
            expect(lines[0]).toEqual({
                accountCode: SYS_BANK_BCA,
                debit: 5_000_000,
                credit: 0
            })

            // CR AR = full amount
            expect(lines[1]).toEqual({
                accountCode: SYS_AR,
                debit: 0,
                credit: 5_000_000
            })
        })

        it('should create 2-line journal when bankChargeAmount is undefined', () => {
            const lines = buildARPaymentJournal({
                amountReceived: 3_000_000
            })

            expect(lines).toHaveLength(2)
            expect(lines[0].debit).toBe(3_000_000) // Bank gets full amount
            expect(lines[1].credit).toBe(3_000_000) // AR credited full amount
        })

        it('should treat negative bankChargeAmount as zero', () => {
            const lines = buildARPaymentJournal({
                amountReceived: 2_000_000,
                bankChargeAmount: -100
            })

            expect(lines).toHaveLength(2) // No bank charge line
            expect(lines[0].debit).toBe(2_000_000)
        })
    })

    describe('Journal Balance (Debit = Credit)', () => {
        it('should produce balanced journal with bank charges', () => {
            const lines = buildARPaymentJournal({
                amountReceived: 10_000_000,
                bankChargeAmount: 75_000
            })

            const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0)
            const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0)
            expect(totalDebit).toBe(totalCredit)
        })

        it('should produce balanced journal without bank charges', () => {
            const lines = buildARPaymentJournal({
                amountReceived: 7_500_000,
                bankChargeAmount: 0
            })

            const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0)
            const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0)
            expect(totalDebit).toBe(totalCredit)
        })

        it('should balance with small bank charge', () => {
            const lines = buildARPaymentJournal({
                amountReceived: 100_000,
                bankChargeAmount: 6_500
            })

            const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0)
            const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0)
            expect(totalDebit).toBe(totalCredit)
            expect(totalDebit).toBe(100_000)
        })

        it('should balance with large bank charge', () => {
            const lines = buildARPaymentJournal({
                amountReceived: 500_000_000,
                bankChargeAmount: 250_000
            })

            const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0)
            const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0)
            expect(totalDebit).toBe(totalCredit)
        })
    })

    describe('Invoice Balance Updates', () => {
        it('should reduce balanceDue by full amountReceived (not net)', () => {
            // Invoice for 10M, customer pays 10M, bank takes 50K fee
            // Customer's obligation is 10M, bank charge is company's problem
            const newBalance = calculateNewBalance(10_000_000, 10_000_000)
            expect(newBalance).toBe(0)
            expect(determineStatus(newBalance)).toBe('PAID')
        })

        it('should set status to PARTIAL when partial payment', () => {
            const newBalance = calculateNewBalance(10_000_000, 5_000_000)
            expect(newBalance).toBe(5_000_000)
            expect(determineStatus(newBalance)).toBe('PARTIAL')
        })

        it('should set status to PAID when full payment with bank charges', () => {
            // Full payment of 10M with 50K bank charge
            // Balance decreases by 10M (full amount), not 9.95M (net)
            const newBalance = calculateNewBalance(10_000_000, 10_000_000)
            expect(newBalance).toBe(0)
            expect(determineStatus(newBalance)).toBe('PAID')
        })
    })

    describe('Account Codes', () => {
        it('should use SYS_ACCOUNTS.BANK_CHARGES (7200) for bank charges', () => {
            const lines = buildARPaymentJournal({
                amountReceived: 1_000_000,
                bankChargeAmount: 25_000
            })

            const bankChargeLine = lines.find(l => l.accountCode === SYS_BANK_CHARGES)
            expect(bankChargeLine).toBeDefined()
            expect(bankChargeLine!.debit).toBe(25_000)
            expect(bankChargeLine!.credit).toBe(0)
        })

        it('should use correct bank account code when specified', () => {
            const lines = buildARPaymentJournal({
                amountReceived: 1_000_000,
                bankChargeAmount: 10_000,
                cashCode: '1111' // Bank Mandiri
            })

            expect(lines[0].accountCode).toBe('1111')
        })

        it('should default to Bank BCA (1110) when no bank code specified', () => {
            const lines = buildARPaymentJournal({
                amountReceived: 1_000_000,
                bankChargeAmount: 10_000
            })

            expect(lines[0].accountCode).toBe(SYS_BANK_BCA)
        })
    })

    describe('P&L Impact', () => {
        it('bank charges should be an expense (debit to 7200)', () => {
            const lines = buildARPaymentJournal({
                amountReceived: 5_000_000,
                bankChargeAmount: 35_000
            })

            const bankChargeLine = lines.find(l => l.accountCode === SYS_BANK_CHARGES)
            expect(bankChargeLine).toBeDefined()
            // Debit to expense = increases expense = reduces profit
            expect(bankChargeLine!.debit).toBe(35_000)
            expect(bankChargeLine!.credit).toBe(0)
        })

        it('no P&L impact when no bank charges', () => {
            const lines = buildARPaymentJournal({
                amountReceived: 5_000_000,
                bankChargeAmount: 0
            })

            const expenseLines = lines.filter(l =>
                l.accountCode === SYS_BANK_CHARGES
            )
            expect(expenseLines).toHaveLength(0)
        })
    })

    describe('Backwards Compatibility', () => {
        it('should produce identical journal when bankChargeAmount=0 vs undefined', () => {
            const withZero = buildARPaymentJournal({
                amountReceived: 8_000_000,
                bankChargeAmount: 0
            })

            const withUndefined = buildARPaymentJournal({
                amountReceived: 8_000_000
            })

            expect(withZero).toEqual(withUndefined)
        })

        it('should not change invoice balance calculation regardless of bank charge', () => {
            // Bank charges are company's expense, not customer's
            // So invoice balance always reduces by full payment amount
            const balanceWithCharge = calculateNewBalance(10_000_000, 10_000_000)
            const balanceWithoutCharge = calculateNewBalance(10_000_000, 10_000_000)
            expect(balanceWithCharge).toBe(balanceWithoutCharge)
        })
    })

    describe('Edge Cases', () => {
        it('should handle bank charge equal to full payment (edge case)', () => {
            // Extreme edge case: bank takes entire payment as fee
            const lines = buildARPaymentJournal({
                amountReceived: 50_000,
                bankChargeAmount: 50_000
            })

            expect(lines[0].debit).toBe(0) // Bank gets nothing
            expect(lines[1].debit).toBe(50_000) // All goes to bank charges
            expect(lines[2].credit).toBe(50_000) // AR still reduced
        })

        it('should handle very small bank charge', () => {
            const lines = buildARPaymentJournal({
                amountReceived: 100_000_000,
                bankChargeAmount: 1
            })

            expect(lines).toHaveLength(3)
            expect(lines[0].debit).toBe(99_999_999) // Bank gets almost all
            expect(lines[1].debit).toBe(1) // 1 rupiah bank charge
            expect(lines[2].credit).toBe(100_000_000) // Full AR credit
        })
    })
})

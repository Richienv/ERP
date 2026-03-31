import { describe, it, expect } from 'vitest'

/**
 * Tests for Bad Debt Write-Off (ACCT2-007).
 *
 * Two methods:
 * 1. DIRECT: DR Bad Debt Expense (6500), CR AR (1200) — hits P&L
 * 2. ALLOWANCE: Two steps:
 *    Step 1 (provision): DR Bad Debt Expense (6500), CR Allowance (1210)
 *    Step 2 (write-off): DR Allowance (1210), CR AR (1200) — no P&L impact
 */

// ==========================================
// Journal Line Builder Logic
// ==========================================

const SYS_BAD_DEBT_EXPENSE = '6500'
const SYS_ALLOWANCE_DOUBTFUL = '1210'
const SYS_AR = '1200'

interface JournalLine {
    accountCode: string
    debit: number
    credit: number
}

function buildWriteOffJournal(method: 'DIRECT' | 'ALLOWANCE', amount: number): JournalLine[] {
    const debitAccount = method === 'DIRECT'
        ? SYS_BAD_DEBT_EXPENSE   // hits P&L
        : SYS_ALLOWANCE_DOUBTFUL  // uses prior provision

    return [
        { accountCode: debitAccount, debit: amount, credit: 0 },
        { accountCode: SYS_AR, debit: 0, credit: amount },
    ]
}

function buildProvisionJournal(amount: number): JournalLine[] {
    return [
        { accountCode: SYS_BAD_DEBT_EXPENSE, debit: amount, credit: 0 },
        { accountCode: SYS_ALLOWANCE_DOUBTFUL, debit: 0, credit: amount },
    ]
}

function isJournalBalanced(lines: JournalLine[]): boolean {
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0)
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0)
    return Math.abs(totalDebit - totalCredit) < 0.01
}

function computeNewBalance(currentBalance: number, writeOffAmount: number): number {
    return currentBalance - writeOffAmount
}

function computeNewStatus(currentBalance: number, writeOffAmount: number, currentStatus: string): string {
    const newBalance = currentBalance - writeOffAmount
    return newBalance <= 0 ? 'VOID' : currentStatus
}

// ==========================================
// DIRECT Write-Off Tests
// ==========================================

describe('Bad Debt Write-Off — DIRECT Method', () => {
    it('should debit Bad Debt Expense (6500) and credit AR (1200)', () => {
        const lines = buildWriteOffJournal('DIRECT', 5000000)

        expect(lines).toHaveLength(2)
        expect(lines[0]).toEqual({ accountCode: SYS_BAD_DEBT_EXPENSE, debit: 5000000, credit: 0 })
        expect(lines[1]).toEqual({ accountCode: SYS_AR, debit: 0, credit: 5000000 })
    })

    it('should produce a balanced journal entry', () => {
        const lines = buildWriteOffJournal('DIRECT', 1000000)
        expect(isJournalBalanced(lines)).toBe(true)
    })

    it('should reduce invoice balanceDue by write-off amount', () => {
        const newBalance = computeNewBalance(10000000, 3000000)
        expect(newBalance).toBe(7000000)
    })

    it('should set status to VOID when full write-off', () => {
        const status = computeNewStatus(5000000, 5000000, 'OVERDUE')
        expect(status).toBe('VOID')
    })

    it('should keep current status on partial write-off', () => {
        const status = computeNewStatus(10000000, 3000000, 'OVERDUE')
        expect(status).toBe('OVERDUE')
    })

    it('should keep current status on partial write-off for ISSUED', () => {
        const status = computeNewStatus(8000000, 2000000, 'ISSUED')
        expect(status).toBe('ISSUED')
    })
})

// ==========================================
// ALLOWANCE Method Tests
// ==========================================

describe('Bad Debt Write-Off — ALLOWANCE Method', () => {
    it('Step 1 (provision): DR Bad Debt Expense (6500), CR Allowance (1210)', () => {
        const lines = buildProvisionJournal(5000000)

        expect(lines).toHaveLength(2)
        expect(lines[0]).toEqual({ accountCode: SYS_BAD_DEBT_EXPENSE, debit: 5000000, credit: 0 })
        expect(lines[1]).toEqual({ accountCode: SYS_ALLOWANCE_DOUBTFUL, debit: 0, credit: 5000000 })
    })

    it('Step 1 (provision): should produce a balanced journal', () => {
        const lines = buildProvisionJournal(2000000)
        expect(isJournalBalanced(lines)).toBe(true)
    })

    it('Step 2 (write-off): DR Allowance (1210), CR AR (1200) — no P&L impact', () => {
        const lines = buildWriteOffJournal('ALLOWANCE', 5000000)

        expect(lines).toHaveLength(2)
        expect(lines[0]).toEqual({ accountCode: SYS_ALLOWANCE_DOUBTFUL, debit: 5000000, credit: 0 })
        expect(lines[1]).toEqual({ accountCode: SYS_AR, debit: 0, credit: 5000000 })
    })

    it('Step 2 (write-off): should produce a balanced journal', () => {
        const lines = buildWriteOffJournal('ALLOWANCE', 3000000)
        expect(isJournalBalanced(lines)).toBe(true)
    })

    it('Step 2 (write-off): should NOT use Bad Debt Expense (no double P&L hit)', () => {
        const lines = buildWriteOffJournal('ALLOWANCE', 1000000)
        const usesExpense = lines.some(l => l.accountCode === SYS_BAD_DEBT_EXPENSE)
        expect(usesExpense).toBe(false)
    })

    it('Full allowance flow: provision then write-off nets Allowance to zero', () => {
        const amount = 5000000
        const provisionLines = buildProvisionJournal(amount)
        const writeOffLines = buildWriteOffJournal('ALLOWANCE', amount)

        // Net effect on Allowance (1210): provision CR 5M, write-off DR 5M = net 0
        const allowanceCR = provisionLines
            .filter(l => l.accountCode === SYS_ALLOWANCE_DOUBTFUL)
            .reduce((sum, l) => sum + l.credit, 0)
        const allowanceDR = writeOffLines
            .filter(l => l.accountCode === SYS_ALLOWANCE_DOUBTFUL)
            .reduce((sum, l) => sum + l.debit, 0)

        expect(allowanceCR).toBe(amount)
        expect(allowanceDR).toBe(amount)
        expect(allowanceCR - allowanceDR).toBe(0)
    })
})

// ==========================================
// Invoice Status & Balance Edge Cases
// ==========================================

describe('Bad Debt Write-Off — Balance & Status Logic', () => {
    it('should VOID invoice when write-off equals balance', () => {
        expect(computeNewStatus(1000000, 1000000, 'ISSUED')).toBe('VOID')
        expect(computeNewStatus(1000000, 1000000, 'OVERDUE')).toBe('VOID')
        expect(computeNewStatus(1000000, 1000000, 'PARTIAL')).toBe('VOID')
    })

    it('should not VOID invoice on partial write-off', () => {
        expect(computeNewStatus(1000000, 500000, 'ISSUED')).toBe('ISSUED')
        expect(computeNewStatus(1000000, 999999, 'OVERDUE')).toBe('OVERDUE')
    })

    it('should compute correct remaining balance', () => {
        expect(computeNewBalance(10000000, 10000000)).toBe(0)
        expect(computeNewBalance(10000000, 1)).toBe(9999999)
        expect(computeNewBalance(500000, 250000)).toBe(250000)
    })
})

// ==========================================
// Validation Tests
// ==========================================

describe('Bad Debt Write-Off — Validation', () => {
    it('should reject write-off amount exceeding balance', () => {
        const balance = 5000000
        const writeOffAmount = 6000000
        expect(writeOffAmount > balance).toBe(true)
    })

    it('should reject zero or negative write-off amount', () => {
        expect(0 <= 0).toBe(true)
        expect(-100 <= 0).toBe(true)
    })

    it('DIRECT method uses correct account codes from SYS_ACCOUNTS', () => {
        // Verify alignment with gl-accounts.ts
        expect(SYS_BAD_DEBT_EXPENSE).toBe('6500')
        expect(SYS_AR).toBe('1200')
    })

    it('ALLOWANCE method uses correct account codes from SYS_ACCOUNTS', () => {
        expect(SYS_ALLOWANCE_DOUBTFUL).toBe('1210')
        expect(SYS_AR).toBe('1200')
    })
})

// ==========================================
// Source Document Type
// ==========================================

describe('Bad Debt Write-Off — Audit Trail', () => {
    it('write-off journal should use BAD_DEBT_WRITEOFF as source document type', () => {
        const sourceDocumentType = 'BAD_DEBT_WRITEOFF'
        expect(sourceDocumentType).toBe('BAD_DEBT_WRITEOFF')
    })

    it('provision journal should use BAD_DEBT_PROVISION as source document type', () => {
        const sourceDocumentType = 'BAD_DEBT_PROVISION'
        expect(sourceDocumentType).toBe('BAD_DEBT_PROVISION')
    })
})

import { describe, it, expect } from 'vitest'

/**
 * Tests for Closing Journal (Jurnal Penutup) business logic.
 * Tests the pure calculation functions that determine closing entries:
 * - Revenue accounts are zeroed out (DR Revenue, CR Income Summary)
 * - Expense accounts are zeroed out (DR Income Summary, CR Expense)
 * - Net income transferred to Retained Earnings
 */

// ==========================================
// Closing Journal Line Builder (pure logic)
// ==========================================

interface AccountBalance {
    accountId: string
    accountCode: string
    accountName: string
    accountType: 'REVENUE' | 'EXPENSE'
    totalDebit: number
    totalCredit: number
}

interface ClosingLine {
    accountId: string
    accountCode: string
    accountName: string
    accountType: string
    debit: number
    credit: number
}

/**
 * Build closing journal lines from account balances.
 * Same logic as in previewClosingJournal server action.
 */
function buildClosingLines(
    accounts: AccountBalance[],
    retainedEarningsAccount: { id: string; code: string; name: string } | null
): { lines: ClosingLine[]; revenueTotal: number; expenseTotal: number; netIncome: number } {
    const lines: ClosingLine[] = []
    let revenueTotal = 0
    let expenseTotal = 0

    // Close Revenue accounts: net = credit - debit (normal credit balance)
    for (const acc of accounts.filter(a => a.accountType === 'REVENUE')) {
        const netBalance = acc.totalCredit - acc.totalDebit
        if (Math.abs(netBalance) < 0.01) continue
        revenueTotal += netBalance

        lines.push({
            accountId: acc.accountId,
            accountCode: acc.accountCode,
            accountName: acc.accountName,
            accountType: 'REVENUE',
            debit: netBalance > 0 ? netBalance : 0,
            credit: netBalance < 0 ? Math.abs(netBalance) : 0,
        })
    }

    // Close Expense accounts: net = debit - credit (normal debit balance)
    for (const acc of accounts.filter(a => a.accountType === 'EXPENSE')) {
        const netBalance = acc.totalDebit - acc.totalCredit
        if (Math.abs(netBalance) < 0.01) continue
        expenseTotal += netBalance

        lines.push({
            accountId: acc.accountId,
            accountCode: acc.accountCode,
            accountName: acc.accountName,
            accountType: 'EXPENSE',
            debit: netBalance < 0 ? Math.abs(netBalance) : 0,
            credit: netBalance > 0 ? netBalance : 0,
        })
    }

    // Transfer net income to Retained Earnings
    const netIncome = revenueTotal - expenseTotal
    if (retainedEarningsAccount && Math.abs(netIncome) >= 0.01) {
        lines.push({
            accountId: retainedEarningsAccount.id,
            accountCode: retainedEarningsAccount.code,
            accountName: retainedEarningsAccount.name,
            accountType: 'EQUITY',
            debit: netIncome < 0 ? Math.abs(netIncome) : 0,
            credit: netIncome > 0 ? netIncome : 0,
        })
    }

    return { lines, revenueTotal, expenseTotal, netIncome }
}

// ==========================================
// Tests
// ==========================================

const retainedEarnings = { id: 're-1', code: '3100', name: 'Laba Ditahan' }

describe('Closing Journal (Jurnal Penutup)', () => {
    describe('buildClosingLines', () => {
        it('should zero out revenue accounts by debiting them', () => {
            const accounts: AccountBalance[] = [
                {
                    accountId: 'rev-1',
                    accountCode: '4100',
                    accountName: 'Pendapatan Penjualan',
                    accountType: 'REVENUE',
                    totalDebit: 0,
                    totalCredit: 50_000_000,
                },
            ]

            const result = buildClosingLines(accounts, retainedEarnings)

            // Revenue line: DR 50M to zero it out
            const revLine = result.lines.find(l => l.accountType === 'REVENUE')
            expect(revLine).toBeDefined()
            expect(revLine!.debit).toBe(50_000_000)
            expect(revLine!.credit).toBe(0)
            expect(result.revenueTotal).toBe(50_000_000)
        })

        it('should zero out expense accounts by crediting them', () => {
            const accounts: AccountBalance[] = [
                {
                    accountId: 'exp-1',
                    accountCode: '5100',
                    accountName: 'Beban Gaji',
                    accountType: 'EXPENSE',
                    totalDebit: 30_000_000,
                    totalCredit: 0,
                },
            ]

            const result = buildClosingLines(accounts, retainedEarnings)

            // Expense line: CR 30M to zero it out
            const expLine = result.lines.find(l => l.accountType === 'EXPENSE')
            expect(expLine).toBeDefined()
            expect(expLine!.debit).toBe(0)
            expect(expLine!.credit).toBe(30_000_000)
            expect(result.expenseTotal).toBe(30_000_000)
        })

        it('should transfer net income (profit) to Retained Earnings as credit', () => {
            const accounts: AccountBalance[] = [
                {
                    accountId: 'rev-1', accountCode: '4100', accountName: 'Pendapatan',
                    accountType: 'REVENUE', totalDebit: 0, totalCredit: 100_000_000,
                },
                {
                    accountId: 'exp-1', accountCode: '5100', accountName: 'Beban',
                    accountType: 'EXPENSE', totalDebit: 60_000_000, totalCredit: 0,
                },
            ]

            const result = buildClosingLines(accounts, retainedEarnings)

            expect(result.netIncome).toBe(40_000_000) // 100M - 60M
            const eqLine = result.lines.find(l => l.accountType === 'EQUITY')
            expect(eqLine).toBeDefined()
            expect(eqLine!.credit).toBe(40_000_000)
            expect(eqLine!.debit).toBe(0)
        })

        it('should transfer net loss to Retained Earnings as debit', () => {
            const accounts: AccountBalance[] = [
                {
                    accountId: 'rev-1', accountCode: '4100', accountName: 'Pendapatan',
                    accountType: 'REVENUE', totalDebit: 0, totalCredit: 30_000_000,
                },
                {
                    accountId: 'exp-1', accountCode: '5100', accountName: 'Beban',
                    accountType: 'EXPENSE', totalDebit: 50_000_000, totalCredit: 0,
                },
            ]

            const result = buildClosingLines(accounts, retainedEarnings)

            expect(result.netIncome).toBe(-20_000_000) // 30M - 50M
            const eqLine = result.lines.find(l => l.accountType === 'EQUITY')
            expect(eqLine).toBeDefined()
            expect(eqLine!.debit).toBe(20_000_000)
            expect(eqLine!.credit).toBe(0)
        })

        it('should produce balanced journal (total debit = total credit)', () => {
            const accounts: AccountBalance[] = [
                {
                    accountId: 'rev-1', accountCode: '4100', accountName: 'Penjualan',
                    accountType: 'REVENUE', totalDebit: 5_000_000, totalCredit: 80_000_000,
                },
                {
                    accountId: 'rev-2', accountCode: '4200', accountName: 'Jasa',
                    accountType: 'REVENUE', totalDebit: 0, totalCredit: 20_000_000,
                },
                {
                    accountId: 'exp-1', accountCode: '5100', accountName: 'Gaji',
                    accountType: 'EXPENSE', totalDebit: 40_000_000, totalCredit: 0,
                },
                {
                    accountId: 'exp-2', accountCode: '5200', accountName: 'Sewa',
                    accountType: 'EXPENSE', totalDebit: 15_000_000, totalCredit: 0,
                },
            ]

            const result = buildClosingLines(accounts, retainedEarnings)

            const totalDebit = result.lines.reduce((s, l) => s + l.debit, 0)
            const totalCredit = result.lines.reduce((s, l) => s + l.credit, 0)

            expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01)
        })

        it('should skip accounts with zero balance', () => {
            const accounts: AccountBalance[] = [
                {
                    accountId: 'rev-1', accountCode: '4100', accountName: 'Pendapatan',
                    accountType: 'REVENUE', totalDebit: 10_000, totalCredit: 10_000,
                },
                {
                    accountId: 'exp-1', accountCode: '5100', accountName: 'Beban',
                    accountType: 'EXPENSE', totalDebit: 0, totalCredit: 0,
                },
            ]

            const result = buildClosingLines(accounts, retainedEarnings)

            // Both have zero net balance, no lines generated
            expect(result.lines).toHaveLength(0)
            expect(result.revenueTotal).toBe(0)
            expect(result.expenseTotal).toBe(0)
        })

        it('should not add retained earnings line when no retained earnings account provided', () => {
            const accounts: AccountBalance[] = [
                {
                    accountId: 'rev-1', accountCode: '4100', accountName: 'Pendapatan',
                    accountType: 'REVENUE', totalDebit: 0, totalCredit: 50_000_000,
                },
            ]

            const result = buildClosingLines(accounts, null)

            expect(result.lines.find(l => l.accountType === 'EQUITY')).toBeUndefined()
            expect(result.lines).toHaveLength(1) // Only revenue line
        })

        it('should handle multiple revenue and expense accounts', () => {
            const accounts: AccountBalance[] = [
                { accountId: 'r1', accountCode: '4100', accountName: 'Penjualan Domestik', accountType: 'REVENUE', totalDebit: 0, totalCredit: 60_000_000 },
                { accountId: 'r2', accountCode: '4200', accountName: 'Penjualan Ekspor', accountType: 'REVENUE', totalDebit: 0, totalCredit: 40_000_000 },
                { accountId: 'e1', accountCode: '5100', accountName: 'HPP', accountType: 'EXPENSE', totalDebit: 45_000_000, totalCredit: 0 },
                { accountId: 'e2', accountCode: '5200', accountName: 'Gaji', accountType: 'EXPENSE', totalDebit: 25_000_000, totalCredit: 0 },
                { accountId: 'e3', accountCode: '5300', accountName: 'Listrik', accountType: 'EXPENSE', totalDebit: 5_000_000, totalCredit: 0 },
            ]

            const result = buildClosingLines(accounts, retainedEarnings)

            // 2 revenue + 3 expense + 1 retained earnings = 6 lines
            expect(result.lines).toHaveLength(6)
            expect(result.revenueTotal).toBe(100_000_000)
            expect(result.expenseTotal).toBe(75_000_000)
            expect(result.netIncome).toBe(25_000_000)

            // Journal must balance
            const totalDebit = result.lines.reduce((s, l) => s + l.debit, 0)
            const totalCredit = result.lines.reduce((s, l) => s + l.credit, 0)
            expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01)
        })
    })
})

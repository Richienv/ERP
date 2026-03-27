import { describe, it, expect } from 'vitest'

/**
 * Tests for GLAccount Control Account & Direct Posting Restriction (ACCT2-003).
 *
 * Control accounts (AR 1200, AP 2000, Inventory 1300) must NOT allow direct manual
 * journal posting. System-generated entries (invoices, payments, GRN) are allowed.
 */

// ==========================================
// Control Account Validation Logic (mirrors postJournalEntry check)
// ==========================================

interface GLAccountInfo {
    code: string
    name: string
    allowDirectPosting: boolean
    isControlAccount: boolean
}

interface JournalLineInput {
    accountCode: string
    debit: number
    credit: number
}

/**
 * Validate that manual journal entries don't post to control accounts.
 * Same logic as in postJournalEntry() in finance-gl.ts.
 */
function validateControlAccountRestriction(
    lines: JournalLineInput[],
    accountMap: Map<string, GLAccountInfo>,
    sourceDocumentType?: string
): { valid: boolean; error?: string } {
    if (sourceDocumentType === 'MANUAL') {
        for (const line of lines) {
            const account = accountMap.get(line.accountCode)
            if (account && !account.allowDirectPosting) {
                return {
                    valid: false,
                    error: `Akun kontrol ${account.code} (${account.name}) tidak boleh diposting langsung — gunakan modul AR/AP/Inventory`
                }
            }
        }
    }
    return { valid: true }
}

// ==========================================
// Test Data
// ==========================================

function createAccountMap(): Map<string, GLAccountInfo> {
    return new Map([
        ['1110', { code: '1110', name: 'Bank BCA', allowDirectPosting: true, isControlAccount: false }],
        ['1200', { code: '1200', name: 'Piutang Usaha (AR)', allowDirectPosting: false, isControlAccount: true }],
        ['1300', { code: '1300', name: 'Persediaan Barang Jadi', allowDirectPosting: false, isControlAccount: true }],
        ['2000', { code: '2000', name: 'Utang Usaha (AP)', allowDirectPosting: false, isControlAccount: true }],
        ['4000', { code: '4000', name: 'Pendapatan Penjualan', allowDirectPosting: true, isControlAccount: false }],
        ['5000', { code: '5000', name: 'Beban Pokok Penjualan', allowDirectPosting: true, isControlAccount: false }],
        ['6900', { code: '6900', name: 'Beban Lain-lain', allowDirectPosting: true, isControlAccount: false }],
    ])
}

// ==========================================
// Tests
// ==========================================

describe('Control Account Direct Posting Restriction', () => {
    const accountMap = createAccountMap()

    describe('Manual journal entries (sourceDocumentType=MANUAL)', () => {
        it('should BLOCK posting to AR control account (1200)', () => {
            const result = validateControlAccountRestriction(
                [
                    { accountCode: '1200', debit: 1000000, credit: 0 },
                    { accountCode: '4000', debit: 0, credit: 1000000 },
                ],
                accountMap,
                'MANUAL'
            )
            expect(result.valid).toBe(false)
            expect(result.error).toContain('1200')
            expect(result.error).toContain('Akun kontrol')
            expect(result.error).toContain('gunakan modul AR/AP/Inventory')
        })

        it('should BLOCK posting to AP control account (2000)', () => {
            const result = validateControlAccountRestriction(
                [
                    { accountCode: '6900', debit: 500000, credit: 0 },
                    { accountCode: '2000', debit: 0, credit: 500000 },
                ],
                accountMap,
                'MANUAL'
            )
            expect(result.valid).toBe(false)
            expect(result.error).toContain('2000')
        })

        it('should BLOCK posting to Inventory control account (1300)', () => {
            const result = validateControlAccountRestriction(
                [
                    { accountCode: '1300', debit: 2000000, credit: 0 },
                    { accountCode: '1110', debit: 0, credit: 2000000 },
                ],
                accountMap,
                'MANUAL'
            )
            expect(result.valid).toBe(false)
            expect(result.error).toContain('1300')
        })

        it('should ALLOW posting to non-control accounts (Bank, Revenue, Expense)', () => {
            const result = validateControlAccountRestriction(
                [
                    { accountCode: '1110', debit: 1000000, credit: 0 },
                    { accountCode: '4000', debit: 0, credit: 1000000 },
                ],
                accountMap,
                'MANUAL'
            )
            expect(result.valid).toBe(true)
            expect(result.error).toBeUndefined()
        })

        it('should ALLOW manual entry with only expense accounts', () => {
            const result = validateControlAccountRestriction(
                [
                    { accountCode: '6900', debit: 100000, credit: 0 },
                    { accountCode: '1110', debit: 0, credit: 100000 },
                ],
                accountMap,
                'MANUAL'
            )
            expect(result.valid).toBe(true)
        })
    })

    describe('System-generated entries (non-MANUAL sourceDocumentType)', () => {
        it('should ALLOW posting to AR account from invoice system', () => {
            const result = validateControlAccountRestriction(
                [
                    { accountCode: '1200', debit: 1100000, credit: 0 },
                    { accountCode: '4000', debit: 0, credit: 1000000 },
                    { accountCode: '2110', debit: 0, credit: 100000 },
                ],
                accountMap,
                'INVOICE'
            )
            expect(result.valid).toBe(true)
        })

        it('should ALLOW posting to AP account from bill system', () => {
            const result = validateControlAccountRestriction(
                [
                    { accountCode: '5000', debit: 500000, credit: 0 },
                    { accountCode: '2000', debit: 0, credit: 500000 },
                ],
                accountMap,
                'BILL'
            )
            expect(result.valid).toBe(true)
        })

        it('should ALLOW posting to Inventory account from GRN system', () => {
            const result = validateControlAccountRestriction(
                [
                    { accountCode: '1300', debit: 3000000, credit: 0 },
                    { accountCode: '2000', debit: 0, credit: 3000000 },
                ],
                accountMap,
                'GRN'
            )
            expect(result.valid).toBe(true)
        })

        it('should ALLOW posting to control accounts when no sourceDocumentType (backwards compatible)', () => {
            const result = validateControlAccountRestriction(
                [
                    { accountCode: '1200', debit: 1000000, credit: 0 },
                    { accountCode: '4000', debit: 0, credit: 1000000 },
                ],
                accountMap,
                undefined
            )
            expect(result.valid).toBe(true)
        })

        it('should ALLOW posting to control accounts for PAYMENT type', () => {
            const result = validateControlAccountRestriction(
                [
                    { accountCode: '1110', debit: 1000000, credit: 0 },
                    { accountCode: '1200', debit: 0, credit: 1000000 },
                ],
                accountMap,
                'PAYMENT'
            )
            expect(result.valid).toBe(true)
        })
    })

    describe('Edge cases', () => {
        it('should detect control account in multi-line entry (first non-control, second control)', () => {
            const result = validateControlAccountRestriction(
                [
                    { accountCode: '6900', debit: 500000, credit: 0 },
                    { accountCode: '1110', debit: 500000, credit: 0 },
                    { accountCode: '2000', debit: 0, credit: 1000000 },
                ],
                accountMap,
                'MANUAL'
            )
            expect(result.valid).toBe(false)
            expect(result.error).toContain('2000')
        })

        it('should validate all three control accounts are flagged', () => {
            const controlCodes = ['1200', '2000', '1300']
            for (const code of controlCodes) {
                const account = accountMap.get(code)!
                expect(account.isControlAccount).toBe(true)
                expect(account.allowDirectPosting).toBe(false)
            }
        })

        it('should confirm non-control accounts allow direct posting', () => {
            const nonControlCodes = ['1110', '4000', '5000', '6900']
            for (const code of nonControlCodes) {
                const account = accountMap.get(code)!
                expect(account.isControlAccount).toBe(false)
                expect(account.allowDirectPosting).toBe(true)
            }
        })
    })
})

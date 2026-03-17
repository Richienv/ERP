/**
 * ACCT2-012: Immutable Posted Entries & Journal Reversal Mechanism
 *
 * Tests:
 * 1. POSTED journal entries cannot be updated or deleted
 * 2. reverseJournalEntry() creates a new entry with swapped debit/credit
 * 3. Reversal is auto-posted (status=POSTED)
 * 4. Original entry is marked isReversed=true with reversedById
 * 5. Already-reversed entries cannot be reversed again
 * 6. Net GL impact of original + reversal = zero
 */

import { describe, it, expect } from 'vitest'

// ==========================================
// Types (mirror schema)
// ==========================================

type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
type EntryStatus = 'DRAFT' | 'POSTED' | 'VOID'

interface JournalLine {
    id: string
    accountId: string
    accountCode: string
    accountType: AccountType
    debit: number
    credit: number
    description: string
}

interface JournalEntry {
    id: string
    description: string
    reference: string | null
    status: EntryStatus
    isReversed: boolean
    reversedById: string | null
    lines: JournalLine[]
}

// ==========================================
// Immutability Validation Logic
// ==========================================

function validateUpdateAllowed(entry: { status: EntryStatus }): { allowed: boolean; error?: string } {
    if (entry.status === 'POSTED') {
        return { allowed: false, error: 'Jurnal yang sudah diposting tidak dapat diubah — buat jurnal balik' }
    }
    if (entry.status !== 'DRAFT') {
        return { allowed: false, error: 'Hanya jurnal DRAFT yang dapat diedit' }
    }
    return { allowed: true }
}

function validateDeleteAllowed(entry: { status: EntryStatus }): { allowed: boolean; error?: string } {
    if (entry.status === 'POSTED') {
        return { allowed: false, error: 'Jurnal yang sudah diposting tidak dapat dihapus — buat jurnal balik' }
    }
    return { allowed: true }
}

// ==========================================
// Reversal Logic (mirrors reverseJournalEntry)
// ==========================================

interface ReversalResult {
    success: boolean
    error?: string
    reversalEntry?: JournalEntry
    originalUpdated?: { isReversed: boolean; reversedById: string }
    glBalanceChanges?: Map<string, number>
}

function createReversal(original: JournalEntry): ReversalResult {
    if (original.status !== 'POSTED') {
        return { success: false, error: 'Hanya jurnal POSTED yang dapat dibalik' }
    }
    if (original.isReversed) {
        return { success: false, error: 'Jurnal ini sudah dibalik' }
    }

    const reversalId = `rev-${original.id}`

    // Create reversal entry with swapped lines
    const reversalLines: JournalLine[] = original.lines.map((line, i) => ({
        id: `rev-line-${i}`,
        accountId: line.accountId,
        accountCode: line.accountCode,
        accountType: line.accountType,
        debit: line.credit,    // swap
        credit: line.debit,    // swap
        description: `Pembalikan: ${line.description}`
    }))

    const reversalEntry: JournalEntry = {
        id: reversalId,
        description: `Pembalikan: ${original.description}`,
        reference: original.reference ? `REV-${original.reference}` : `REV-${original.id.slice(0, 8)}`,
        status: 'POSTED',
        isReversed: false,
        reversedById: null,
        lines: reversalLines
    }

    // Calculate GL balance changes from reversal
    const glBalanceChanges = new Map<string, number>()
    for (const line of reversalLines) {
        let balanceChange = 0
        if (['ASSET', 'EXPENSE'].includes(line.accountType)) {
            balanceChange = line.debit - line.credit
        } else {
            balanceChange = line.credit - line.debit
        }
        const current = glBalanceChanges.get(line.accountId) || 0
        glBalanceChanges.set(line.accountId, current + balanceChange)
    }

    return {
        success: true,
        reversalEntry,
        originalUpdated: { isReversed: true, reversedById: reversalId },
        glBalanceChanges
    }
}

function calculateGLImpact(lines: JournalLine[]): Map<string, number> {
    const impact = new Map<string, number>()
    for (const line of lines) {
        let balanceChange = 0
        if (['ASSET', 'EXPENSE'].includes(line.accountType)) {
            balanceChange = line.debit - line.credit
        } else {
            balanceChange = line.credit - line.debit
        }
        const current = impact.get(line.accountId) || 0
        impact.set(line.accountId, current + balanceChange)
    }
    return impact
}

// ==========================================
// Test Data
// ==========================================

function createSampleEntry(): JournalEntry {
    return {
        id: 'je-001',
        description: 'Penjualan tunai',
        reference: 'INV-2026-0001',
        status: 'POSTED',
        isReversed: false,
        reversedById: null,
        lines: [
            { id: 'l1', accountId: 'acc-1110', accountCode: '1110', accountType: 'ASSET', debit: 1100000, credit: 0, description: 'Bank BCA' },
            { id: 'l2', accountId: 'acc-4000', accountCode: '4000', accountType: 'REVENUE', debit: 0, credit: 1000000, description: 'Pendapatan' },
            { id: 'l3', accountId: 'acc-2121', accountCode: '2121', accountType: 'LIABILITY', debit: 0, credit: 100000, description: 'PPN Keluaran' },
        ]
    }
}

// ==========================================
// Tests
// ==========================================

describe('Immutable Posted Journal Entries', () => {
    describe('Update restriction', () => {
        it('should BLOCK updating a POSTED entry', () => {
            const result = validateUpdateAllowed({ status: 'POSTED' })
            expect(result.allowed).toBe(false)
            expect(result.error).toContain('jurnal balik')
        })

        it('should ALLOW updating a DRAFT entry', () => {
            const result = validateUpdateAllowed({ status: 'DRAFT' })
            expect(result.allowed).toBe(true)
        })

        it('should BLOCK updating a VOID entry', () => {
            const result = validateUpdateAllowed({ status: 'VOID' })
            expect(result.allowed).toBe(false)
        })
    })

    describe('Delete restriction', () => {
        it('should BLOCK deleting a POSTED entry', () => {
            const result = validateDeleteAllowed({ status: 'POSTED' })
            expect(result.allowed).toBe(false)
            expect(result.error).toContain('jurnal balik')
        })

        it('should ALLOW deleting a DRAFT entry', () => {
            const result = validateDeleteAllowed({ status: 'DRAFT' })
            expect(result.allowed).toBe(true)
        })
    })
})

describe('Journal Entry Reversal', () => {
    describe('Reversal creation', () => {
        it('should create a reversal entry with swapped debit/credit', () => {
            const original = createSampleEntry()
            const result = createReversal(original)

            expect(result.success).toBe(true)
            expect(result.reversalEntry).toBeDefined()
            const rev = result.reversalEntry!

            // Line 1: Bank BCA - original DR 1,100,000 → reversal CR 1,100,000
            expect(rev.lines[0].debit).toBe(0)
            expect(rev.lines[0].credit).toBe(1100000)

            // Line 2: Pendapatan - original CR 1,000,000 → reversal DR 1,000,000
            expect(rev.lines[1].debit).toBe(1000000)
            expect(rev.lines[1].credit).toBe(0)

            // Line 3: PPN - original CR 100,000 → reversal DR 100,000
            expect(rev.lines[2].debit).toBe(100000)
            expect(rev.lines[2].credit).toBe(0)
        })

        it('should auto-post the reversal entry (status=POSTED)', () => {
            const original = createSampleEntry()
            const result = createReversal(original)

            expect(result.reversalEntry!.status).toBe('POSTED')
        })

        it('should set reversal description as "Pembalikan: [original]"', () => {
            const original = createSampleEntry()
            const result = createReversal(original)

            expect(result.reversalEntry!.description).toBe('Pembalikan: Penjualan tunai')
        })

        it('should set reversal reference as "REV-[original reference]"', () => {
            const original = createSampleEntry()
            const result = createReversal(original)

            expect(result.reversalEntry!.reference).toBe('REV-INV-2026-0001')
        })

        it('should handle entries without reference', () => {
            const original = createSampleEntry()
            original.reference = null
            const result = createReversal(original)

            expect(result.reversalEntry!.reference).toBe('REV-je-001')
        })

        it('should mark original as reversed with link to reversal', () => {
            const original = createSampleEntry()
            const result = createReversal(original)

            expect(result.originalUpdated!.isReversed).toBe(true)
            expect(result.originalUpdated!.reversedById).toBe(result.reversalEntry!.id)
        })
    })

    describe('Reversal GL impact', () => {
        it('should produce net zero GL impact (original + reversal)', () => {
            const original = createSampleEntry()
            const originalImpact = calculateGLImpact(original.lines)
            const result = createReversal(original)
            const reversalImpact = result.glBalanceChanges!

            // For each account, original + reversal should equal zero
            for (const [accountId, originalChange] of originalImpact) {
                const reversalChange = reversalImpact.get(accountId) || 0
                expect(originalChange + reversalChange).toBe(0)
            }
        })

        it('should correctly reverse ASSET account balance (debit-normal)', () => {
            const original = createSampleEntry()
            const result = createReversal(original)

            // Bank BCA (ASSET): original DR 1,100,000 → balance +1,100,000
            // Reversal CR 1,100,000 → balance -1,100,000. Net = 0
            const bankChange = result.glBalanceChanges!.get('acc-1110')!
            expect(bankChange).toBe(-1100000) // reversal decreases asset balance
        })

        it('should correctly reverse REVENUE account balance (credit-normal)', () => {
            const original = createSampleEntry()
            const result = createReversal(original)

            // Pendapatan (REVENUE): original CR 1,000,000 → balance +1,000,000
            // Reversal DR 1,000,000 → balance -1,000,000. Net = 0
            const revenueChange = result.glBalanceChanges!.get('acc-4000')!
            expect(revenueChange).toBe(-1000000)
        })

        it('should correctly reverse LIABILITY account balance (credit-normal)', () => {
            const original = createSampleEntry()
            const result = createReversal(original)

            // PPN (LIABILITY): original CR 100,000 → balance +100,000
            // Reversal DR 100,000 → balance -100,000. Net = 0
            const ppnChange = result.glBalanceChanges!.get('acc-2121')!
            expect(ppnChange).toBe(-100000)
        })
    })

    describe('Reversal validation', () => {
        it('should REJECT reversal of non-POSTED entry (DRAFT)', () => {
            const entry = createSampleEntry()
            entry.status = 'DRAFT'
            const result = createReversal(entry)

            expect(result.success).toBe(false)
            expect(result.error).toContain('Hanya jurnal POSTED')
        })

        it('should REJECT reversal of non-POSTED entry (VOID)', () => {
            const entry = createSampleEntry()
            entry.status = 'VOID'
            const result = createReversal(entry)

            expect(result.success).toBe(false)
            expect(result.error).toContain('Hanya jurnal POSTED')
        })

        it('should REJECT reversal of already-reversed entry', () => {
            const entry = createSampleEntry()
            entry.isReversed = true
            entry.reversedById = 'rev-existing'
            const result = createReversal(entry)

            expect(result.success).toBe(false)
            expect(result.error).toContain('sudah dibalik')
        })
    })

    describe('Reversal balanced check', () => {
        it('should produce balanced reversal entry (total debit = total credit)', () => {
            const original = createSampleEntry()
            const result = createReversal(original)
            const rev = result.reversalEntry!

            const totalDebit = rev.lines.reduce((sum, l) => sum + l.debit, 0)
            const totalCredit = rev.lines.reduce((sum, l) => sum + l.credit, 0)

            expect(totalDebit).toBe(totalCredit)
        })

        it('should preserve line account assignments in reversal', () => {
            const original = createSampleEntry()
            const result = createReversal(original)
            const rev = result.reversalEntry!

            for (let i = 0; i < original.lines.length; i++) {
                expect(rev.lines[i].accountId).toBe(original.lines[i].accountId)
                expect(rev.lines[i].accountCode).toBe(original.lines[i].accountCode)
            }
        })
    })
})

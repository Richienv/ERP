/**
 * ACCT2-011: Bank Reconciliation Auto GL — Post Charges & Interest During Recon
 *
 * Tests that closeReconciliation() auto-creates journal entries for
 * items classified as BANK_CHARGE or INTEREST_INCOME.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mock setup ---

const mockFindMany = vi.fn()
const mockCount = vi.fn()
const mockFindUniqueOrThrow = vi.fn()
const mockUpdate = vi.fn()
const mockBankReconciliationItemUpdate = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {},
  withPrismaAuth: vi.fn(async (fn: any) => {
    const mockPrisma = {
      bankReconciliationItem: {
        count: mockCount,
        findMany: mockFindMany,
        update: mockBankReconciliationItemUpdate,
      },
      bankReconciliation: {
        findUniqueOrThrow: mockFindUniqueOrThrow,
        update: mockUpdate,
      },
    }
    return fn(mockPrisma)
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
  })),
}))

const mockPostJournalEntry = vi.fn()
const mockGetNextJournalRef = vi.fn()

vi.mock('@/lib/actions/finance-gl', () => ({
  postJournalEntry: (...args: any[]) => mockPostJournalEntry(...args),
  getNextJournalRef: (...args: any[]) => mockGetNextJournalRef(...args),
}))

const mockEnsureSystemAccounts = vi.fn()

vi.mock('@/lib/gl-accounts-server', () => ({
  SYS_ACCOUNTS: {
    BANK_CHARGES: '7200',
    INTEREST_INCOME: '4400',
    BANK_BCA: '1110',
  },
  ensureSystemAccounts: (...args: any[]) => mockEnsureSystemAccounts(...args),
}))

// --- Import after mocks ---
import { closeReconciliation, classifyReconciliationItem } from '@/lib/actions/finance-reconciliation'

beforeEach(() => {
  vi.clearAllMocks()
  mockPostJournalEntry.mockResolvedValue({ success: true, id: 'je-1' })
  mockGetNextJournalRef.mockResolvedValue('RECON-2026-0001')
  mockEnsureSystemAccounts.mockResolvedValue(undefined)
})

// --- Tests ---

describe('classifyReconciliationItem', () => {
  it('marks item as BANK_CHARGE with correct excludeReason', async () => {
    const result = await classifyReconciliationItem('item-1', 'BANK_CHARGE')

    expect(result.success).toBe(true)
    expect(mockBankReconciliationItemUpdate).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: {
        itemType: 'BANK_CHARGE',
        matchStatus: 'EXCLUDED',
        excludeReason: 'Biaya bank — jurnal otomatis saat finalisasi',
      },
    })
  })

  it('marks item as INTEREST_INCOME with correct excludeReason', async () => {
    const result = await classifyReconciliationItem('item-2', 'INTEREST_INCOME')

    expect(result.success).toBe(true)
    expect(mockBankReconciliationItemUpdate).toHaveBeenCalledWith({
      where: { id: 'item-2' },
      data: {
        itemType: 'INTEREST_INCOME',
        matchStatus: 'EXCLUDED',
        excludeReason: 'Pendapatan bunga — jurnal otomatis saat finalisasi',
      },
    })
  })
})

describe('closeReconciliation — auto GL posting', () => {
  const reconciliationId = 'recon-1'
  const statementDate = new Date('2026-03-15')

  function setupMocks(autoGlItems: any[]) {
    // No unmatched items
    mockCount.mockResolvedValue(0)

    // Reconciliation with bank account
    mockFindUniqueOrThrow.mockResolvedValue({
      id: reconciliationId,
      statementDate,
      glAccount: { code: '1110' },
    })

    // Items classified for auto-GL
    mockFindMany.mockResolvedValue(autoGlItems)

    // Update reconciliation
    mockUpdate.mockResolvedValue({})
  }

  it('auto-posts bank charge journal on close: DR Bank Charges, CR Bank', async () => {
    setupMocks([
      {
        id: 'item-charge-1',
        itemType: 'BANK_CHARGE',
        bankAmount: -15000,
        bankDate: new Date('2026-03-10'),
        bankDescription: 'Biaya admin bulanan',
      },
    ])

    const result = await closeReconciliation(reconciliationId)

    expect(result.success).toBe(true)
    expect(mockEnsureSystemAccounts).toHaveBeenCalled()
    expect(mockPostJournalEntry).toHaveBeenCalledTimes(1)
    expect(mockPostJournalEntry).toHaveBeenCalledWith({
      description: expect.stringContaining('Biaya bank'),
      date: new Date('2026-03-10'),
      reference: 'RECON-2026-0001',
      sourceDocumentType: 'BANK_RECONCILIATION',
      lines: [
        { accountCode: '7200', debit: 15000, credit: 0, description: 'Biaya bank' },
        { accountCode: '1110', debit: 0, credit: 15000, description: 'Biaya bank' },
      ],
    })
  })

  it('auto-posts interest income journal on close: DR Bank, CR Interest Income', async () => {
    setupMocks([
      {
        id: 'item-interest-1',
        itemType: 'INTEREST_INCOME',
        bankAmount: 50000,
        bankDate: new Date('2026-03-12'),
        bankDescription: 'Bunga deposito',
      },
    ])

    const result = await closeReconciliation(reconciliationId)

    expect(result.success).toBe(true)
    expect(mockPostJournalEntry).toHaveBeenCalledTimes(1)
    expect(mockPostJournalEntry).toHaveBeenCalledWith({
      description: expect.stringContaining('Pendapatan bunga'),
      date: new Date('2026-03-12'),
      reference: 'RECON-2026-0001',
      sourceDocumentType: 'BANK_RECONCILIATION',
      lines: [
        { accountCode: '1110', debit: 50000, credit: 0, description: 'Pendapatan bunga' },
        { accountCode: '4400', debit: 0, credit: 50000, description: 'Pendapatan bunga' },
      ],
    })
  })

  it('handles multiple auto-GL items in one close', async () => {
    mockGetNextJournalRef
      .mockResolvedValueOnce('RECON-2026-0001')
      .mockResolvedValueOnce('RECON-2026-0002')

    setupMocks([
      {
        id: 'item-c1',
        itemType: 'BANK_CHARGE',
        bankAmount: -10000,
        bankDate: new Date('2026-03-05'),
        bankDescription: 'Transfer fee',
      },
      {
        id: 'item-i1',
        itemType: 'INTEREST_INCOME',
        bankAmount: 25000,
        bankDate: new Date('2026-03-10'),
        bankDescription: 'Monthly interest',
      },
    ])

    const result = await closeReconciliation(reconciliationId)

    expect(result.success).toBe(true)
    expect(mockPostJournalEntry).toHaveBeenCalledTimes(2)

    // First call: bank charge
    const call1 = mockPostJournalEntry.mock.calls[0][0]
    expect(call1.lines[0].accountCode).toBe('7200')
    expect(call1.lines[1].accountCode).toBe('1110')
    expect(call1.sourceDocumentType).toBe('BANK_RECONCILIATION')

    // Second call: interest income
    const call2 = mockPostJournalEntry.mock.calls[1][0]
    expect(call2.lines[0].accountCode).toBe('1110')
    expect(call2.lines[1].accountCode).toBe('4400')
    expect(call2.sourceDocumentType).toBe('BANK_RECONCILIATION')
  })

  it('skips auto-GL for items with zero amount', async () => {
    setupMocks([
      {
        id: 'item-zero',
        itemType: 'BANK_CHARGE',
        bankAmount: 0,
        bankDate: new Date('2026-03-01'),
        bankDescription: 'Zero charge',
      },
    ])

    const result = await closeReconciliation(reconciliationId)

    expect(result.success).toBe(true)
    // ensureSystemAccounts still called (items exist), but no journal posted
    expect(mockPostJournalEntry).not.toHaveBeenCalled()
  })

  it('does not post GL when no classified items exist', async () => {
    setupMocks([]) // No BANK_CHARGE or INTEREST_INCOME items

    const result = await closeReconciliation(reconciliationId)

    expect(result.success).toBe(true)
    expect(mockEnsureSystemAccounts).not.toHaveBeenCalled()
    expect(mockPostJournalEntry).not.toHaveBeenCalled()
  })

  it('fails close when GL posting fails (atomic)', async () => {
    setupMocks([
      {
        id: 'item-fail',
        itemType: 'BANK_CHARGE',
        bankAmount: -5000,
        bankDate: new Date('2026-03-08'),
        bankDescription: 'Fee',
      },
    ])
    mockPostJournalEntry.mockResolvedValue({ success: false, error: 'Period closed' })

    const result = await closeReconciliation(reconciliationId)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Gagal posting jurnal biaya bank')
    // Reconciliation should NOT be marked as completed
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('blocks close when unmatched items remain', async () => {
    mockCount.mockResolvedValue(3) // 3 unmatched items
    // Other mocks not needed since we return early

    const result = await closeReconciliation(reconciliationId)

    expect(result.success).toBe(false)
    expect(result.error).toContain('3 item belum dicocokkan')
  })

  it('uses bankDate when available, falls back to statementDate', async () => {
    setupMocks([
      {
        id: 'item-nodate',
        itemType: 'INTEREST_INCOME',
        bankAmount: 20000,
        bankDate: null, // No specific date
        bankDescription: 'Interest',
      },
    ])

    const result = await closeReconciliation(reconciliationId)

    expect(result.success).toBe(true)
    const call = mockPostJournalEntry.mock.calls[0][0]
    expect(call.date).toEqual(statementDate)
  })

  it('uses absolute value of bankAmount (handles negative amounts for charges)', async () => {
    setupMocks([
      {
        id: 'item-neg',
        itemType: 'BANK_CHARGE',
        bankAmount: -25000, // Negative amount from bank statement
        bankDate: new Date('2026-03-14'),
        bankDescription: 'Admin fee',
      },
    ])

    const result = await closeReconciliation(reconciliationId)

    expect(result.success).toBe(true)
    const call = mockPostJournalEntry.mock.calls[0][0]
    // Should use absolute value 25000, not -25000
    expect(call.lines[0].debit).toBe(25000)
    expect(call.lines[1].credit).toBe(25000)
  })

  it('includes item description in journal description', async () => {
    setupMocks([
      {
        id: 'item-desc',
        itemType: 'BANK_CHARGE',
        bankAmount: -7500,
        bankDate: new Date('2026-03-01'),
        bankDescription: 'Biaya transfer antar bank',
      },
    ])

    const result = await closeReconciliation(reconciliationId)

    expect(result.success).toBe(true)
    const call = mockPostJournalEntry.mock.calls[0][0]
    expect(call.description).toContain('Biaya transfer antar bank')
  })

  it('marks reconciliation as REC_COMPLETED with closedBy and closedAt', async () => {
    setupMocks([])

    const result = await closeReconciliation(reconciliationId)

    expect(result.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: reconciliationId },
      data: {
        status: 'REC_COMPLETED',
        closedBy: 'user-1',
        closedAt: expect.any(Date),
      },
    })
  })
})

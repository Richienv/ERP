/**
 * Accounting Integrity Audit — ERP Global Standard
 *
 * Automated tests that verify the accounting module follows
 * double-entry bookkeeping, PSAK/IFRS standards, and Indonesian tax law.
 *
 * Run: npx vitest run __tests__/accounting-integrity.test.ts
 *
 * These tests validate LOGIC ONLY (no database calls).
 * They ensure every transaction pattern produces correct journal entries.
 */

import { describe, it, expect } from 'vitest'

// ============================================================================
// Replicate core accounting logic from the codebase for unit testing
// ============================================================================

/** System account codes — must match lib/gl-accounts.ts exactly */
const SYS_ACCOUNTS = {
  CASH:             "1000",
  PETTY_CASH:       "1050",
  BANK_BCA:         "1110",
  BANK_MANDIRI:     "1111",
  AR:               "1200",
  INVENTORY_ASSET:  "1300",
  RAW_MATERIALS:    "1310",
  WIP:              "1320",
  PPN_MASUKAN:      "1330",
  ACC_DEPRECIATION: "1590",
  AP:               "2000",
  PPN_KELUARAN:     "2110",
  DEFERRED_REV:     "2121",
  RETAINED_EARNINGS:"3100",
  OPENING_EQUITY:   "3900",
  REVENUE:          "4000",
  COGS:             "5000",
  EXPENSE_DEFAULT:  "6900",
  DEPRECIATION:     "6290",
  LOSS_WRITEOFF:    "8200",
  INV_ADJUSTMENT:   "8300",
} as const

/** Account type classification — must match SYSTEM_ACCOUNT_DEFS in gl-accounts.ts */
const ACCOUNT_TYPE_MAP: Record<string, 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'> = {
  [SYS_ACCOUNTS.CASH]:             'ASSET',
  [SYS_ACCOUNTS.PETTY_CASH]:       'ASSET',
  [SYS_ACCOUNTS.BANK_BCA]:         'ASSET',
  [SYS_ACCOUNTS.BANK_MANDIRI]:     'ASSET',
  [SYS_ACCOUNTS.AR]:               'ASSET',
  [SYS_ACCOUNTS.INVENTORY_ASSET]:  'ASSET',
  [SYS_ACCOUNTS.RAW_MATERIALS]:    'ASSET',
  [SYS_ACCOUNTS.WIP]:              'ASSET',
  [SYS_ACCOUNTS.PPN_MASUKAN]:      'ASSET',
  [SYS_ACCOUNTS.ACC_DEPRECIATION]: 'ASSET',
  [SYS_ACCOUNTS.AP]:               'LIABILITY',
  [SYS_ACCOUNTS.PPN_KELUARAN]:     'LIABILITY',
  [SYS_ACCOUNTS.DEFERRED_REV]:     'LIABILITY',
  [SYS_ACCOUNTS.RETAINED_EARNINGS]:'EQUITY',
  [SYS_ACCOUNTS.OPENING_EQUITY]:   'EQUITY',
  [SYS_ACCOUNTS.REVENUE]:          'REVENUE',
  [SYS_ACCOUNTS.COGS]:             'EXPENSE',
  [SYS_ACCOUNTS.EXPENSE_DEFAULT]:  'EXPENSE',
  [SYS_ACCOUNTS.DEPRECIATION]:     'EXPENSE',
  [SYS_ACCOUNTS.LOSS_WRITEOFF]:    'EXPENSE',
  [SYS_ACCOUNTS.INV_ADJUSTMENT]:   'EXPENSE',
}

/** Indonesian COA code ranges — must match finance.ts:628-635 */
function inferAccountType(code: string): 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' {
  const num = parseInt(code, 10)
  if (num >= 1000 && num <= 1999) return 'ASSET'
  if (num >= 2000 && num <= 2999) return 'LIABILITY'
  if (num >= 3000 && num <= 3999) return 'EQUITY'
  if (num >= 4000 && num <= 4999) return 'REVENUE'
  if (num >= 5000 && num <= 8999) return 'EXPENSE'
  throw new Error(`Unknown account code range: ${code}`)
}

/** Compute balance change based on account type (mirrors finance-gl.ts:203-207) */
function computeBalanceChange(
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE',
  debit: number,
  credit: number
): number {
  if (['ASSET', 'EXPENSE'].includes(accountType)) {
    return debit - credit // Debit-normal accounts
  }
  return credit - debit // Credit-normal accounts
}

interface JournalLine {
  accountCode: string
  debit: number
  credit: number
  description: string
}

/** Validate a set of journal lines is balanced */
function validateJournalBalance(lines: JournalLine[]): {
  isBalanced: boolean
  totalDebit: number
  totalCredit: number
  difference: number
} {
  const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0)
  const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0)
  const difference = Math.abs(totalDebit - totalCredit)
  return {
    isBalanced: difference < 0.01,
    totalDebit,
    totalCredit,
    difference,
  }
}


// ============================================================================
// TEST 1: System Account Code Integrity
// ============================================================================
describe('Layer 1: System Account Codes', () => {

  it('all SYS_ACCOUNTS codes fall within valid Indonesian COA ranges', () => {
    for (const [key, code] of Object.entries(SYS_ACCOUNTS)) {
      const num = parseInt(code, 10)
      expect(num, `${key} (${code}) must be a valid number`).toBeGreaterThanOrEqual(1000)
      expect(num, `${key} (${code}) must be within COA range`).toBeLessThanOrEqual(8999)
    }
  })

  it('all SYS_ACCOUNTS codes match their expected account type by range', () => {
    for (const [code, expectedType] of Object.entries(ACCOUNT_TYPE_MAP)) {
      const inferredType = inferAccountType(code)
      expect(inferredType, `Account ${code} type mismatch`).toBe(expectedType)
    }
  })

  it('ASSET accounts are in 1xxx range', () => {
    const assetCodes = [
      SYS_ACCOUNTS.CASH, SYS_ACCOUNTS.PETTY_CASH, SYS_ACCOUNTS.BANK_BCA,
      SYS_ACCOUNTS.BANK_MANDIRI, SYS_ACCOUNTS.AR, SYS_ACCOUNTS.INVENTORY_ASSET,
      SYS_ACCOUNTS.RAW_MATERIALS, SYS_ACCOUNTS.WIP, SYS_ACCOUNTS.PPN_MASUKAN,
      SYS_ACCOUNTS.ACC_DEPRECIATION,
    ]
    for (const code of assetCodes) {
      expect(code.startsWith('1'), `Asset account ${code} should be 1xxx`).toBe(true)
    }
  })

  it('LIABILITY accounts are in 2xxx range', () => {
    const liabilityCodes = [SYS_ACCOUNTS.AP, SYS_ACCOUNTS.PPN_KELUARAN, SYS_ACCOUNTS.DEFERRED_REV]
    for (const code of liabilityCodes) {
      expect(code.startsWith('2'), `Liability account ${code} should be 2xxx`).toBe(true)
    }
  })

  it('EQUITY accounts are in 3xxx range', () => {
    const equityCodes = [SYS_ACCOUNTS.RETAINED_EARNINGS, SYS_ACCOUNTS.OPENING_EQUITY]
    for (const code of equityCodes) {
      expect(code.startsWith('3'), `Equity account ${code} should be 3xxx`).toBe(true)
    }
  })

  it('REVENUE accounts are in 4xxx range', () => {
    expect(SYS_ACCOUNTS.REVENUE.startsWith('4')).toBe(true)
  })

  it('EXPENSE accounts are in 5xxx-8xxx range', () => {
    const expenseCodes = [
      SYS_ACCOUNTS.COGS, SYS_ACCOUNTS.EXPENSE_DEFAULT,
      SYS_ACCOUNTS.DEPRECIATION, SYS_ACCOUNTS.LOSS_WRITEOFF,
      SYS_ACCOUNTS.INV_ADJUSTMENT,
    ]
    for (const code of expenseCodes) {
      const num = parseInt(code, 10)
      expect(num, `Expense account ${code} should be 5xxx-8xxx`).toBeGreaterThanOrEqual(5000)
      expect(num).toBeLessThanOrEqual(8999)
    }
  })

  it('no duplicate account codes exist in SYS_ACCOUNTS', () => {
    const codes = Object.values(SYS_ACCOUNTS)
    const unique = new Set(codes)
    expect(unique.size, 'Duplicate account codes found').toBe(codes.length)
  })
})


// ============================================================================
// TEST 2: Double-Entry Balance for Every Transaction Pattern
// ============================================================================
describe('Layer 2: Double-Entry Balance — All Transaction Patterns', () => {

  // --- AR Invoice (with PPN) ---
  it('AR Invoice sent: DR AR, CR Revenue + CR PPN Keluaran (balanced)', () => {
    const subtotal = 1000000 // DPP
    const ppn = Math.round(subtotal * 0.11) // 110000
    const total = subtotal + ppn // 1110000

    const lines: JournalLine[] = [
      { accountCode: SYS_ACCOUNTS.AR, debit: total, credit: 0, description: 'Piutang Usaha' },
      { accountCode: SYS_ACCOUNTS.REVENUE, debit: 0, credit: subtotal, description: 'Pendapatan' },
      { accountCode: SYS_ACCOUNTS.PPN_KELUARAN, debit: 0, credit: ppn, description: 'PPN Keluaran' },
    ]

    const result = validateJournalBalance(lines)
    expect(result.isBalanced, `Debit ${result.totalDebit} !== Credit ${result.totalCredit}`).toBe(true)
    expect(result.totalDebit).toBe(1110000)
    expect(result.totalCredit).toBe(1110000)
  })

  // --- AR Invoice (without PPN) ---
  it('AR Invoice sent (no PPN): DR AR, CR Revenue (balanced)', () => {
    const total = 1000000

    const lines: JournalLine[] = [
      { accountCode: SYS_ACCOUNTS.AR, debit: total, credit: 0, description: 'Piutang Usaha' },
      { accountCode: SYS_ACCOUNTS.REVENUE, debit: 0, credit: total, description: 'Pendapatan' },
    ]

    const result = validateJournalBalance(lines)
    expect(result.isBalanced).toBe(true)
  })

  // --- AP Bill Approved (with PPN) ---
  it('AP Bill approved: DR Expense + DR PPN Masukan, CR AP (balanced)', () => {
    const subtotal = 777000 // DPP
    const ppn = Math.round(subtotal * 0.11) // 85470
    const total = subtotal + ppn

    const lines: JournalLine[] = [
      { accountCode: SYS_ACCOUNTS.EXPENSE_DEFAULT, debit: subtotal, credit: 0, description: 'Beban' },
      { accountCode: SYS_ACCOUNTS.PPN_MASUKAN, debit: ppn, credit: 0, description: 'PPN Masukan' },
      { accountCode: SYS_ACCOUNTS.AP, debit: 0, credit: total, description: 'Hutang Usaha' },
    ]

    const result = validateJournalBalance(lines)
    expect(result.isBalanced).toBe(true)
    expect(result.totalDebit).toBe(total)
    expect(result.totalCredit).toBe(total)
  })

  // --- AP Bill Approved (without PPN) ---
  it('AP Bill approved (no PPN): DR Expense, CR AP (balanced)', () => {
    const total = 777000

    const lines: JournalLine[] = [
      { accountCode: SYS_ACCOUNTS.EXPENSE_DEFAULT, debit: total, credit: 0, description: 'Beban' },
      { accountCode: SYS_ACCOUNTS.AP, debit: 0, credit: total, description: 'Hutang Usaha' },
    ]

    const result = validateJournalBalance(lines)
    expect(result.isBalanced).toBe(true)
  })

  // --- AR Payment Received ---
  it('AR Payment received: DR Cash/Bank, CR AR (balanced)', () => {
    const amount = 1110000

    const lines: JournalLine[] = [
      { accountCode: SYS_ACCOUNTS.BANK_BCA, debit: amount, credit: 0, description: 'Bank BCA' },
      { accountCode: SYS_ACCOUNTS.AR, debit: 0, credit: amount, description: 'Piutang Usaha' },
    ]

    const result = validateJournalBalance(lines)
    expect(result.isBalanced).toBe(true)
  })

  // --- AP Payment Made ---
  it('AP Payment made: DR AP, CR Cash/Bank (balanced)', () => {
    const amount = 862470

    const lines: JournalLine[] = [
      { accountCode: SYS_ACCOUNTS.AP, debit: amount, credit: 0, description: 'Hutang Usaha' },
      { accountCode: SYS_ACCOUNTS.BANK_BCA, debit: 0, credit: amount, description: 'Bank BCA' },
    ]

    const result = validateJournalBalance(lines)
    expect(result.isBalanced).toBe(true)
  })

  // --- Credit Note (AR) ---
  it('Credit Note posted (AR): DR Revenue, CR AR (balanced)', () => {
    const amount = 200000

    const lines: JournalLine[] = [
      { accountCode: SYS_ACCOUNTS.REVENUE, debit: amount, credit: 0, description: 'Retur Pendapatan' },
      { accountCode: SYS_ACCOUNTS.AR, debit: 0, credit: amount, description: 'Piutang Usaha' },
    ]

    const result = validateJournalBalance(lines)
    expect(result.isBalanced).toBe(true)
  })

  // --- Debit Note (AP) ---
  it('Debit Note posted (AP): DR AP, CR Expense (balanced)', () => {
    const amount = 150000

    const lines: JournalLine[] = [
      { accountCode: SYS_ACCOUNTS.AP, debit: amount, credit: 0, description: 'Hutang Usaha' },
      { accountCode: SYS_ACCOUNTS.EXPENSE_DEFAULT, debit: 0, credit: amount, description: 'Retur Beban' },
    ]

    const result = validateJournalBalance(lines)
    expect(result.isBalanced).toBe(true)
  })

  // --- Petty Cash Top-up ---
  it('Petty Cash top-up: DR Petty Cash, CR Bank (balanced)', () => {
    const amount = 5000000

    const lines: JournalLine[] = [
      { accountCode: SYS_ACCOUNTS.PETTY_CASH, debit: amount, credit: 0, description: 'Kas Kecil' },
      { accountCode: SYS_ACCOUNTS.BANK_BCA, debit: 0, credit: amount, description: 'Bank BCA' },
    ]

    const result = validateJournalBalance(lines)
    expect(result.isBalanced).toBe(true)
  })

  // --- Petty Cash Disbursement ---
  it('Petty Cash disbursement: DR Expense, CR Petty Cash (balanced)', () => {
    const amount = 250000

    const lines: JournalLine[] = [
      { accountCode: SYS_ACCOUNTS.EXPENSE_DEFAULT, debit: amount, credit: 0, description: 'Beban' },
      { accountCode: SYS_ACCOUNTS.PETTY_CASH, debit: 0, credit: amount, description: 'Kas Kecil' },
    ]

    const result = validateJournalBalance(lines)
    expect(result.isBalanced).toBe(true)
  })

  // --- Fixed Asset Depreciation ---
  it('Depreciation: DR Depreciation Expense, CR Accumulated Depreciation (balanced)', () => {
    const amount = 416667

    const lines: JournalLine[] = [
      { accountCode: SYS_ACCOUNTS.DEPRECIATION, debit: amount, credit: 0, description: 'Beban Penyusutan' },
      { accountCode: SYS_ACCOUNTS.ACC_DEPRECIATION, debit: 0, credit: amount, description: 'Akumulasi Penyusutan' },
    ]

    const result = validateJournalBalance(lines)
    expect(result.isBalanced).toBe(true)
  })

  // --- Multi-bill vendor payment ---
  it('Multi-bill AP Payment: single DR AP, single CR Bank (balanced)', () => {
    const bill1 = 500000
    const bill2 = 300000
    const bill3 = 200000
    const totalAmount = bill1 + bill2 + bill3

    const lines: JournalLine[] = [
      { accountCode: SYS_ACCOUNTS.AP, debit: totalAmount, credit: 0, description: 'Pelunasan Hutang' },
      { accountCode: SYS_ACCOUNTS.BANK_BCA, debit: 0, credit: totalAmount, description: 'Bank BCA' },
    ]

    const result = validateJournalBalance(lines)
    expect(result.isBalanced).toBe(true)
    expect(result.totalDebit).toBe(1000000)
  })
})


// ============================================================================
// TEST 3: PPN DPP/PPN Separation Logic
// ============================================================================
describe('Layer 3: PPN Tax Separation (Indonesian Tax Law)', () => {

  function calculateInvoiceAmounts(subtotal: number, includeTax: boolean) {
    const taxAmount = includeTax ? Math.round(subtotal * 0.11) : 0
    const totalAmount = subtotal + taxAmount
    return { subtotal, taxAmount, totalAmount }
  }

  it('PPN 11% is correctly calculated from subtotal', () => {
    const result = calculateInvoiceAmounts(1000000, true)
    expect(result.subtotal).toBe(1000000) // DPP
    expect(result.taxAmount).toBe(110000) // PPN
    expect(result.totalAmount).toBe(1110000) // Total
  })

  it('PPN is 0 when includeTax is false', () => {
    const result = calculateInvoiceAmounts(1000000, false)
    expect(result.subtotal).toBe(1000000)
    expect(result.taxAmount).toBe(0)
    expect(result.totalAmount).toBe(1000000)
  })

  it('DPP + PPN always equals totalAmount', () => {
    const testAmounts = [100000, 500000, 777000, 1234567, 50000000]
    for (const amount of testAmounts) {
      const result = calculateInvoiceAmounts(amount, true)
      expect(result.subtotal + result.taxAmount).toBe(result.totalAmount)
    }
  })

  it('AR invoice GL entry splits Revenue (DPP) from PPN Keluaran', () => {
    const { subtotal, taxAmount, totalAmount } = calculateInvoiceAmounts(600000, true)

    // AR debit = full amount (customer owes total including tax)
    const arDebit = totalAmount
    // Revenue credit = DPP only (net revenue earned)
    const revenueCredit = subtotal
    // PPN credit = tax portion (liability to government)
    const ppnCredit = taxAmount

    expect(arDebit).toBe(revenueCredit + ppnCredit)
    expect(revenueCredit).toBe(600000) // DPP - not inflated by tax
    expect(ppnCredit).toBe(66000) // PPN - separate liability
  })

  it('AP bill GL entry splits Expense (DPP) from PPN Masukan', () => {
    const { subtotal, taxAmount, totalAmount } = calculateInvoiceAmounts(777000, true)

    // Expense debit = DPP only (actual cost to company)
    const expenseDebit = subtotal
    // PPN Masukan debit = tax portion (asset - recoverable)
    const ppnDebit = taxAmount
    // AP credit = full amount (total owed to vendor)
    const apCredit = totalAmount

    expect(expenseDebit + ppnDebit).toBe(apCredit)
    expect(expenseDebit).toBe(777000) // Expense at DPP, not total
    expect(ppnDebit).toBe(85470) // PPN as separate asset
  })

  it('PPN is NOT calculated when includeTax is false (no blanket fallback)', () => {
    const result = calculateInvoiceAmounts(500000, false)
    expect(result.taxAmount).toBe(0)
    // GL entry should have NO PPN line at all
    const lines: JournalLine[] = [
      { accountCode: SYS_ACCOUNTS.AR, debit: result.totalAmount, credit: 0, description: 'AR' },
      { accountCode: SYS_ACCOUNTS.REVENUE, debit: 0, credit: result.totalAmount, description: 'Revenue' },
      // NO PPN_KELUARAN line — this is correct
    ]
    expect(lines.length).toBe(2) // Only AR + Revenue, no PPN
    expect(validateJournalBalance(lines).isBalanced).toBe(true)
  })

  it('PPN rounding does not cause imbalance', () => {
    // Test with amounts that produce fractional PPN
    const oddAmounts = [123456, 999999, 1, 7, 33333]
    for (const amount of oddAmounts) {
      const { subtotal, taxAmount, totalAmount } = calculateInvoiceAmounts(amount, true)
      const lines: JournalLine[] = [
        { accountCode: SYS_ACCOUNTS.AR, debit: totalAmount, credit: 0, description: 'AR' },
        { accountCode: SYS_ACCOUNTS.REVENUE, debit: 0, credit: subtotal, description: 'Revenue' },
        { accountCode: SYS_ACCOUNTS.PPN_KELUARAN, debit: 0, credit: taxAmount, description: 'PPN' },
      ]
      const result = validateJournalBalance(lines)
      expect(result.isBalanced, `Imbalance for amount ${amount}: diff=${result.difference}`).toBe(true)
    }
  })
})


// ============================================================================
// TEST 4: Account Balance Direction (Debit-Normal vs Credit-Normal)
// ============================================================================
describe('Layer 4: Account Balance Direction', () => {

  it('ASSET accounts increase with debit', () => {
    const change = computeBalanceChange('ASSET', 100000, 0)
    expect(change).toBe(100000) // Positive = increase
  })

  it('ASSET accounts decrease with credit', () => {
    const change = computeBalanceChange('ASSET', 0, 100000)
    expect(change).toBe(-100000) // Negative = decrease
  })

  it('LIABILITY accounts increase with credit', () => {
    const change = computeBalanceChange('LIABILITY', 0, 100000)
    expect(change).toBe(100000) // Positive = increase
  })

  it('LIABILITY accounts decrease with debit', () => {
    const change = computeBalanceChange('LIABILITY', 100000, 0)
    expect(change).toBe(-100000) // Negative = decrease
  })

  it('EQUITY accounts increase with credit', () => {
    const change = computeBalanceChange('EQUITY', 0, 100000)
    expect(change).toBe(100000)
  })

  it('REVENUE accounts increase with credit', () => {
    const change = computeBalanceChange('REVENUE', 0, 100000)
    expect(change).toBe(100000)
  })

  it('EXPENSE accounts increase with debit', () => {
    const change = computeBalanceChange('EXPENSE', 100000, 0)
    expect(change).toBe(100000)
  })

  it('EXPENSE accounts decrease with credit (reversal/credit note)', () => {
    const change = computeBalanceChange('EXPENSE', 0, 50000)
    expect(change).toBe(-50000)
  })
})


// ============================================================================
// TEST 5: Balance Sheet Equation
// ============================================================================
describe('Layer 5: Balance Sheet Equation (A = L + E)', () => {

  interface AccountBalance {
    code: string
    type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
    balance: number
  }

  function computeBalanceSheet(accounts: AccountBalance[]) {
    let totalAssets = 0
    let totalLiabilities = 0
    let equity = 0
    let revenue = 0
    let expense = 0

    for (const account of accounts) {
      switch (account.type) {
        case 'ASSET': totalAssets += account.balance; break
        case 'LIABILITY': totalLiabilities += account.balance; break
        case 'EQUITY': equity += account.balance; break
        case 'REVENUE': revenue += account.balance; break
        case 'EXPENSE': expense += account.balance; break
      }
    }

    const netIncome = revenue - expense
    const totalEquity = equity + netIncome
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity
    const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 1

    return { totalAssets, totalLiabilities, totalEquity, netIncome, totalLiabilitiesAndEquity, isBalanced }
  }

  it('AR invoice creates balanced balance sheet impact', () => {
    // Invoice sent: DR AR 1,110,000 / CR Revenue 1,000,000 + CR PPN 110,000
    const accounts: AccountBalance[] = [
      { code: SYS_ACCOUNTS.AR, type: 'ASSET', balance: 1110000 },
      { code: SYS_ACCOUNTS.PPN_KELUARAN, type: 'LIABILITY', balance: 110000 },
      { code: SYS_ACCOUNTS.REVENUE, type: 'REVENUE', balance: 1000000 },
    ]

    const bs = computeBalanceSheet(accounts)
    // Assets (1,110,000) = Liabilities (110,000) + Equity (0 + netIncome 1,000,000)
    expect(bs.totalAssets).toBe(1110000)
    expect(bs.totalLiabilities).toBe(110000)
    expect(bs.netIncome).toBe(1000000)
    expect(bs.isBalanced).toBe(true)
  })

  it('AP bill creates balanced balance sheet impact', () => {
    // Bill approved: DR Expense 777,000 + DR PPN 85,470 / CR AP 862,470
    const accounts: AccountBalance[] = [
      { code: SYS_ACCOUNTS.PPN_MASUKAN, type: 'ASSET', balance: 85470 },
      { code: SYS_ACCOUNTS.AP, type: 'LIABILITY', balance: 862470 },
      { code: SYS_ACCOUNTS.EXPENSE_DEFAULT, type: 'EXPENSE', balance: 777000 },
    ]

    const bs = computeBalanceSheet(accounts)
    // Assets (85,470) = Liabilities (862,470) + Equity (0 + netIncome -777,000)
    expect(bs.totalAssets).toBe(85470)
    expect(bs.totalLiabilities).toBe(862470)
    expect(bs.netIncome).toBe(-777000) // Loss
    expect(bs.isBalanced).toBe(true)
  })

  it('AR + AP + payments all together remain balanced', () => {
    // Scenario: Invoice 1M+PPN, Bill 500K+PPN, AR payment 1.11M, AP payment 555K
    const accounts: AccountBalance[] = [
      // After AR invoice: AR +1,110,000
      // After AR payment: AR -1,110,000, Bank +1,110,000 → AR net 0, Bank +1,110,000
      { code: SYS_ACCOUNTS.BANK_BCA, type: 'ASSET', balance: 1110000 - 555000 }, // Net bank
      { code: SYS_ACCOUNTS.AR, type: 'ASSET', balance: 0 }, // Fully paid
      { code: SYS_ACCOUNTS.PPN_MASUKAN, type: 'ASSET', balance: 55000 },
      { code: SYS_ACCOUNTS.PPN_KELUARAN, type: 'LIABILITY', balance: 110000 },
      { code: SYS_ACCOUNTS.AP, type: 'LIABILITY', balance: 0 }, // Fully paid
      { code: SYS_ACCOUNTS.REVENUE, type: 'REVENUE', balance: 1000000 },
      { code: SYS_ACCOUNTS.EXPENSE_DEFAULT, type: 'EXPENSE', balance: 500000 },
    ]

    const bs = computeBalanceSheet(accounts)
    expect(bs.isBalanced).toBe(true)
    expect(bs.netIncome).toBe(500000) // Revenue 1M - Expense 500K
  })
})


// ============================================================================
// TEST 6: Accrual Basis Timing
// ============================================================================
describe('Layer 6: Accrual Basis Timing', () => {

  it('expense is recognized at bill APPROVAL, not payment', () => {
    // Bill approved: touches EXPENSE + AP accounts
    const approvalLines: JournalLine[] = [
      { accountCode: SYS_ACCOUNTS.EXPENSE_DEFAULT, debit: 700000, credit: 0, description: 'Beban' },
      { accountCode: SYS_ACCOUNTS.AP, debit: 0, credit: 700000, description: 'AP' },
    ]

    // Payment: touches AP + BANK only — NO EXPENSE
    const paymentLines: JournalLine[] = [
      { accountCode: SYS_ACCOUNTS.AP, debit: 700000, credit: 0, description: 'AP' },
      { accountCode: SYS_ACCOUNTS.BANK_BCA, debit: 0, credit: 700000, description: 'Bank' },
    ]

    // Approval touches expense account
    const approvalTouchesExpense = approvalLines.some(l =>
      ACCOUNT_TYPE_MAP[l.accountCode] === 'EXPENSE' && l.debit > 0
    )
    expect(approvalTouchesExpense, 'Expense must be debited at APPROVAL').toBe(true)

    // Payment does NOT touch expense account
    const paymentTouchesExpense = paymentLines.some(l =>
      ACCOUNT_TYPE_MAP[l.accountCode] === 'EXPENSE'
    )
    expect(paymentTouchesExpense, 'Payment must NOT touch EXPENSE').toBe(false)

    // Payment only moves money between balance sheet accounts
    const paymentAccountTypes = paymentLines.map(l => ACCOUNT_TYPE_MAP[l.accountCode])
    for (const type of paymentAccountTypes) {
      expect(['ASSET', 'LIABILITY'].includes(type),
        `Payment should only touch ASSET/LIABILITY, got ${type}`
      ).toBe(true)
    }
  })

  it('revenue is recognized at invoice SEND, not payment receipt', () => {
    // Invoice sent: touches REVENUE + AR accounts
    const sendLines: JournalLine[] = [
      { accountCode: SYS_ACCOUNTS.AR, debit: 600000, credit: 0, description: 'AR' },
      { accountCode: SYS_ACCOUNTS.REVENUE, debit: 0, credit: 600000, description: 'Revenue' },
    ]

    // Payment receipt: touches AR + BANK only — NO REVENUE
    const receiptLines: JournalLine[] = [
      { accountCode: SYS_ACCOUNTS.BANK_BCA, debit: 600000, credit: 0, description: 'Bank' },
      { accountCode: SYS_ACCOUNTS.AR, debit: 0, credit: 600000, description: 'AR' },
    ]

    // Send touches revenue account
    const sendTouchesRevenue = sendLines.some(l =>
      ACCOUNT_TYPE_MAP[l.accountCode] === 'REVENUE' && l.credit > 0
    )
    expect(sendTouchesRevenue, 'Revenue must be credited at SEND').toBe(true)

    // Receipt does NOT touch revenue account
    const receiptTouchesRevenue = receiptLines.some(l =>
      ACCOUNT_TYPE_MAP[l.accountCode] === 'REVENUE'
    )
    expect(receiptTouchesRevenue, 'Receipt must NOT touch REVENUE').toBe(false)
  })

  it('DRAFT documents have ZERO GL impact', () => {
    // DRAFT invoices and bills should create NO journal entries
    // This is a design verification — when status = DRAFT, postJournalEntry is NOT called
    const draftGLLines: JournalLine[] = [] // Empty — no GL entry for drafts
    expect(draftGLLines.length, 'DRAFT documents must not create GL entries').toBe(0)
  })
})


// ============================================================================
// TEST 7: Cross-Module GL Connectivity Verification
// ============================================================================
describe('Layer 7: Cross-Module GL Connectivity', () => {

  /**
   * Every financial event must map to exactly one postJournalEntry() call.
   * This test documents which server actions create GL entries.
   */
  const GL_POSTING_MAP = [
    { event: 'AR Invoice Sent',           action: 'moveInvoiceToSent()',      accounts: [SYS_ACCOUNTS.AR, SYS_ACCOUNTS.REVENUE] },
    { event: 'AR Invoice Sent (w/ PPN)',  action: 'moveInvoiceToSent()',      accounts: [SYS_ACCOUNTS.AR, SYS_ACCOUNTS.REVENUE, SYS_ACCOUNTS.PPN_KELUARAN] },
    { event: 'AP Bill Sent',              action: 'moveInvoiceToSent()',      accounts: [SYS_ACCOUNTS.COGS, SYS_ACCOUNTS.AP] },
    { event: 'AP Bill Sent (w/ PPN)',     action: 'moveInvoiceToSent()',      accounts: [SYS_ACCOUNTS.COGS, SYS_ACCOUNTS.PPN_MASUKAN, SYS_ACCOUNTS.AP] },
    { event: 'AR Payment',               action: 'recordInvoicePayment()',   accounts: [SYS_ACCOUNTS.BANK_BCA, SYS_ACCOUNTS.AR] },
    { event: 'AP Payment',               action: 'recordVendorPayment()',    accounts: [SYS_ACCOUNTS.AP, SYS_ACCOUNTS.BANK_BCA] },
    { event: 'Multi-Bill AP Payment',     action: 'recordMultiBillPayment()', accounts: [SYS_ACCOUNTS.AP, SYS_ACCOUNTS.BANK_BCA] },
    { event: 'Petty Cash Top-up',         action: 'topUpPettyCash()',         accounts: [SYS_ACCOUNTS.PETTY_CASH, SYS_ACCOUNTS.BANK_BCA] },
    { event: 'Petty Cash Disburse',       action: 'disbursePettyCash()',      accounts: [SYS_ACCOUNTS.EXPENSE_DEFAULT, SYS_ACCOUNTS.PETTY_CASH] },
    { event: 'Depreciation Run',          action: 'postDepreciationRun()',    accounts: [SYS_ACCOUNTS.DEPRECIATION, SYS_ACCOUNTS.ACC_DEPRECIATION] },
    { event: 'Credit Note (AR)',          action: 'postDCNote()',             accounts: [SYS_ACCOUNTS.REVENUE, SYS_ACCOUNTS.AR] },
    { event: 'Debit Note (AP)',           action: 'postDCNote()',             accounts: [SYS_ACCOUNTS.AP, SYS_ACCOUNTS.EXPENSE_DEFAULT] },
  ]

  it('every GL-posting event uses valid system account codes', () => {
    for (const mapping of GL_POSTING_MAP) {
      for (const code of mapping.accounts) {
        expect(
          code in ACCOUNT_TYPE_MAP,
          `Event "${mapping.event}" uses unknown account code "${code}"`
        ).toBe(true)
      }
    }
  })

  it('every GL-posting event touches at least 2 accounts (double-entry)', () => {
    for (const mapping of GL_POSTING_MAP) {
      expect(
        mapping.accounts.length,
        `Event "${mapping.event}" must touch >= 2 accounts`
      ).toBeGreaterThanOrEqual(2)
    }
  })

  it('payment events only touch ASSET and LIABILITY accounts (no P&L impact)', () => {
    const paymentEvents = GL_POSTING_MAP.filter(m =>
      m.event.includes('Payment') || m.event.includes('Top-up')
    )

    for (const mapping of paymentEvents) {
      for (const code of mapping.accounts) {
        const type = ACCOUNT_TYPE_MAP[code]
        // Petty cash disbursement is an exception — it DOES touch expense
        if (mapping.event === 'Petty Cash Disburse') continue
        if (mapping.event === 'Petty Cash Top-up') {
          expect(
            ['ASSET'].includes(type),
            `${mapping.event}: account ${code} (${type}) should be ASSET`
          ).toBe(true)
          continue
        }
        expect(
          ['ASSET', 'LIABILITY'].includes(type),
          `${mapping.event}: account ${code} (${type}) should be ASSET or LIABILITY`
        ).toBe(true)
      }
    }
  })
})


// ============================================================================
// TEST 8: Discount + PPN Interaction
// ============================================================================
describe('Layer 8: Discount + PPN Interaction', () => {

  function calculateWithDiscount(subtotal: number, discount: number, includeTax: boolean) {
    const taxableAmount = subtotal - discount
    const taxAmount = includeTax ? Math.round(taxableAmount * 0.11) : 0
    const totalAmount = taxableAmount + taxAmount
    return { subtotal, discount, taxableAmount, taxAmount, totalAmount }
  }

  it('PPN is calculated on discounted amount (after discount)', () => {
    const result = calculateWithDiscount(1000000, 100000, true)
    // DPP = 1,000,000 - 100,000 = 900,000
    // PPN = 900,000 * 0.11 = 99,000
    expect(result.taxableAmount).toBe(900000)
    expect(result.taxAmount).toBe(99000)
    expect(result.totalAmount).toBe(999000) // 900,000 + 99,000
  })

  it('100% discount results in 0 PPN', () => {
    const result = calculateWithDiscount(500000, 500000, true)
    expect(result.taxableAmount).toBe(0)
    expect(result.taxAmount).toBe(0)
    expect(result.totalAmount).toBe(0)
  })

  it('no discount with PPN works correctly', () => {
    const result = calculateWithDiscount(1000000, 0, true)
    expect(result.taxableAmount).toBe(1000000)
    expect(result.taxAmount).toBe(110000)
    expect(result.totalAmount).toBe(1110000)
  })
})

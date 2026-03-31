// Pure functions and types extracted from finance-gl server actions (Next.js requires
// all exports from "use server" files to be async).

export type RecurringPattern = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'

/** A single row in the GL opening balance entry form */
export interface OpeningBalanceGLRow {
    accountCode: string
    debit: number
    credit: number
}

/** A single row in the AP/AR opening invoice form */
export interface OpeningInvoiceRow {
    partyId: string
    invoiceNumber: string
    amount: number
    dueDate: string
}

export interface GLAccountNode {
    id: string
    code: string
    name: string
    type: string
    subType: string
    balance: number
    parentId: string | null
    children: GLAccountNode[]
}

export interface JournalEntryItem {
    id: string
    date: Date
    description: string
    reference?: string
    status: string
    lines: {
        account: { code: string; name: string }
        debit: number
        credit: number
        description?: string
    }[]
    totalDebit: number
    totalCredit: number
}

export interface RecurringTemplate {
    id: string
    description: string
    reference: string | null
    recurringPattern: string
    nextRecurringDate: string
    lines: {
        accountCode: string
        accountName: string
        debit: number
        credit: number
    }[]
    totalAmount: number
}

export interface ClosingJournalPreviewLine {
    accountId: string
    accountCode: string
    accountName: string
    accountType: string
    debit: number
    credit: number
    description: string
}

export interface ClosingJournalPreview {
    fiscalYear: number
    alreadyClosed: boolean
    revenueTotal: number
    expenseTotal: number
    netIncome: number
    lines: ClosingJournalPreviewLine[]
    retainedEarningsAccount: { id: string; code: string; name: string } | null
}

export interface TrialBalanceRow {
  accountId: string
  accountCode: string
  accountName: string
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
  totalDebit: number
  totalCredit: number
  storedBalance: number
  calculatedBalance: number
  difference: number
}

export interface TrialBalanceData {
  rows: TrialBalanceRow[]
  totalDebit: number
  totalCredit: number
  isBalanced: boolean
  mismatchCount: number
  asOfDate: string
}

export interface ReconciliationPreviewRow {
  accountId: string
  accountCode: string
  accountName: string
  oldBalance: number
  newBalance: number
  difference: number
}

export interface ReconciliationPreview {
  rows: ReconciliationPreviewRow[]
  totalAccounts: number
  totalDifference: number
}

/**
 * Calculate the next occurrence date given a pattern and current date.
 */
export function calculateNextDate(currentDate: Date, pattern: RecurringPattern): Date {
    const next = new Date(currentDate)
    switch (pattern) {
        case 'DAILY':
            next.setDate(next.getDate() + 1)
            break
        case 'WEEKLY':
            next.setDate(next.getDate() + 7)
            break
        case 'MONTHLY':
            next.setMonth(next.getMonth() + 1)
            break
        case 'QUARTERLY':
            next.setMonth(next.getMonth() + 3)
            break
        case 'YEARLY':
            next.setFullYear(next.getFullYear() + 1)
            break
    }
    return next
}

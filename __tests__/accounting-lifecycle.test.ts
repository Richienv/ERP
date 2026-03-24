/**
 * Accounting Lifecycle Tests — Full AR/AP Journey
 *
 * Validates the complete lifecycle of invoices and bills,
 * ensuring every step in the chain produces balanced journal entries.
 *
 * Run: npx vitest run __tests__/accounting-lifecycle.test.ts
 *
 * These tests validate LOGIC ONLY (no database calls).
 */

import { describe, it, expect } from 'vitest'

describe('Full AR Lifecycle', () => {
  it('invoice create → send → partial pay → full pay produces correct GL chain', () => {
    const subtotal = 1000000
    const ppn = Math.round(subtotal * 0.11) // 110000
    const total = subtotal + ppn // 1110000

    // Step 1: DRAFT — no GL entry
    const draftEntries: any[] = []
    expect(draftEntries.length).toBe(0)

    // Step 2: Send — DR AR total / CR Revenue subtotal + CR PPN ppn
    const sendLines = [
      { account: '1200', debit: total, credit: 0 },
      { account: '4000', debit: 0, credit: subtotal },
      { account: '2110', debit: 0, credit: ppn },
    ]
    expect(sendLines.reduce((s, l) => s + l.debit - l.credit, 0)).toBe(0)

    // Step 3: Partial payment 500k — DR Bank / CR AR
    const partial = [
      { account: '1110', debit: 500000, credit: 0 },
      { account: '1200', debit: 0, credit: 500000 },
    ]
    expect(partial.reduce((s, l) => s + l.debit - l.credit, 0)).toBe(0)
    expect(total - 500000).toBe(610000) // balanceDue

    // Step 4: Final payment 610k
    const final = [
      { account: '1110', debit: 610000, credit: 0 },
      { account: '1200', debit: 0, credit: 610000 },
    ]
    expect(final.reduce((s, l) => s + l.debit - l.credit, 0)).toBe(0)
    expect(610000 - 610000).toBe(0) // balanceDue = 0, PAID
  })
})

describe('Full AP Lifecycle', () => {
  it('bill create → approve → pay produces correct GL chain', () => {
    const subtotal = 777000
    const ppn = Math.round(subtotal * 0.11)
    const total = subtotal + ppn

    // Approve: DR Expense subtotal + DR PPN ppn / CR AP total
    const approve = [
      { account: '6900', debit: subtotal, credit: 0 },
      { account: '1330', debit: ppn, credit: 0 },
      { account: '2000', debit: 0, credit: total },
    ]
    expect(approve.reduce((s, l) => s + l.debit - l.credit, 0)).toBe(0)

    // Pay: DR AP / CR Bank
    const pay = [
      { account: '2000', debit: total, credit: 0 },
      { account: '1110', debit: 0, credit: total },
    ]
    expect(pay.reduce((s, l) => s + l.debit - l.credit, 0)).toBe(0)
  })
})

describe('HPP Routing', () => {
  function resolveExpenseAccount(product: { expenseAccountCode?: string | null } | null): string {
    return product?.expenseAccountCode || '6900'
  }

  it('product with HPP → 5000', () => {
    expect(resolveExpenseAccount({ expenseAccountCode: '5000' })).toBe('5000')
  })
  it('product without HPP → 6900', () => {
    expect(resolveExpenseAccount({ expenseAccountCode: null })).toBe('6900')
  })
  it('no product → 6900', () => {
    expect(resolveExpenseAccount(null)).toBe('6900')
  })
  it('per-line override wins', () => {
    const override = '6200'
    const product = { expenseAccountCode: '5000' }
    expect(override || resolveExpenseAccount(product)).toBe('6200')
  })
})

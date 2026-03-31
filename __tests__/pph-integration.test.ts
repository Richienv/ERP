import { describe, it, expect } from "vitest"
import { calculateWithholding, getPPhLiabilityAccount } from "@/lib/pph-helpers"
import { SYS_ACCOUNTS } from "@/lib/gl-accounts"

describe("PPh GL line construction", () => {
  it("AP payment with PPh 23: 3 lines, balanced", () => {
    const billAmount = 20_000_000
    const { amount: pphAmount, netAmount } = calculateWithholding(2, billAmount)
    const pphAccount = getPPhLiabilityAccount("PPH_23")

    const lines = [
      { accountCode: SYS_ACCOUNTS.AP, debit: billAmount, credit: 0 },
      { accountCode: SYS_ACCOUNTS.BANK_BCA, debit: 0, credit: netAmount },
      { accountCode: pphAccount, debit: 0, credit: pphAmount },
    ]

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
    expect(totalDebit).toBe(totalCredit)
    expect(totalDebit).toBe(20_000_000)
    expect(pphAccount).toBe("2220")
  })

  it("AP payment with PPh 4(2) at 10%: balanced", () => {
    const billAmount = 100_000_000
    const { amount: pphAmount, netAmount } = calculateWithholding(10, billAmount)
    const pphAccount = getPPhLiabilityAccount("PPH_4_2")

    const lines = [
      { accountCode: SYS_ACCOUNTS.AP, debit: billAmount, credit: 0 },
      { accountCode: SYS_ACCOUNTS.BANK_BCA, debit: 0, credit: netAmount },
      { accountCode: pphAccount, debit: 0, credit: pphAmount },
    ]

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
    expect(totalDebit).toBe(totalCredit)
    expect(pphAmount).toBe(10_000_000)
    expect(pphAccount).toBe("2230")
  })

  it("AR payment with PPh 23 withheld by customer: 3 lines, balanced", () => {
    const invoiceAmount = 20_000_000
    const { amount: pphAmount } = calculateWithholding(2, invoiceAmount)
    const netReceived = invoiceAmount - pphAmount

    const lines = [
      { accountCode: SYS_ACCOUNTS.BANK_BCA, debit: netReceived, credit: 0 },
      { accountCode: SYS_ACCOUNTS.PPH_PREPAID, debit: pphAmount, credit: 0 },
      { accountCode: SYS_ACCOUNTS.AR, debit: 0, credit: invoiceAmount },
    ]

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
    expect(totalDebit).toBe(totalCredit)
    expect(totalDebit).toBe(20_000_000)
    expect(SYS_ACCOUNTS.PPH_PREPAID).toBe("1340")
  })

  it("PPh deposit: 2 lines, balanced", () => {
    const depositAmount = 400_000
    const pphAccount = getPPhLiabilityAccount("PPH_23")

    const lines = [
      { accountCode: pphAccount, debit: depositAmount, credit: 0 },
      { accountCode: SYS_ACCOUNTS.BANK_BCA, debit: 0, credit: depositAmount },
    ]

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
    expect(totalDebit).toBe(totalCredit)
  })

  it("PPh 21 payroll: liability account is 2210", () => {
    const pph21Account = getPPhLiabilityAccount("PPH_21")
    expect(pph21Account).toBe("2210")
    expect(SYS_ACCOUNTS.PPH_21_PAYABLE).toBe("2210")
  })

  it("no withholding: standard 2-line AP payment, balanced", () => {
    const amount = 50_000_000

    const lines = [
      { accountCode: SYS_ACCOUNTS.AP, debit: amount, credit: 0 },
      { accountCode: SYS_ACCOUNTS.BANK_BCA, debit: 0, credit: amount },
    ]

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
    expect(totalDebit).toBe(totalCredit)
  })
})

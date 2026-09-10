import { describe, expect, it } from "vitest"
import { calculateBPJS } from "@/lib/hcm-calculations"
import { SYS_ACCOUNTS } from "@/lib/gl-accounts"
import {
  buildPayrollJournalLines,
  resolveEmployerBpjsFromSalary,
} from "@/lib/payroll-gl"

const ACCOUNTS = {
  salaryExpense: SYS_ACCOUNTS.SALARY_EXPENSE,
  bpjsEmployerExpense: SYS_ACCOUNTS.BPJS_EMPLOYER_EXPENSE,
  payrollPayable: SYS_ACCOUNTS.SALARY_PAYABLE,
  pph21Payable: SYS_ACCOUNTS.PPH_21_PAYABLE,
  bpjsKesPayable: SYS_ACCOUNTS.BPJS_KES_PAYABLE,
  bpjsTkPayable: SYS_ACCOUNTS.BPJS_TK_PAYABLE,
}

describe("buildPayrollJournalLines", () => {
  it("balances when employer BPJS is posted (the missing ~11%)", () => {
    const salary = 8_000_000
    const bpjs = calculateBPJS(salary)
    const gross = 10_000_000
    const pph21 = 150_000
    const net = gross - bpjs.totalEmployee - pph21

    const journal = buildPayrollJournalLines({
      periodLabel: "Maret 2026",
      gross,
      net,
      pph21,
      bpjsKesEmployee: bpjs.kesehatanEmployee,
      bpjsTkEmployee: bpjs.jhtEmployee + bpjs.jpEmployee,
      bpjsKesEmployer: bpjs.kesehatanEmployer,
      bpjsTkEmployer: bpjs.jhtEmployer + bpjs.jpEmployer + bpjs.jkkEmployer + bpjs.jkmEmployer,
      accounts: ACCOUNTS,
    })

    expect(journal.balanced).toBe(true)
    expect(journal.totalDebit).toBe(journal.totalCredit)
    expect(journal.totalDebit).toBe(gross + bpjs.totalEmployer)

    const expense = journal.lines.find((l) => l.accountCode === SYS_ACCOUNTS.BPJS_EMPLOYER_EXPENSE)
    expect(expense?.debit).toBe(bpjs.totalEmployer)

    const kesPayable = journal.lines.find((l) => l.accountCode === SYS_ACCOUNTS.BPJS_KES_PAYABLE)
    expect(kesPayable?.credit).toBe(bpjs.kesehatanEmployee + bpjs.kesehatanEmployer)
  })

  it("still balances when there is no employer BPJS (legacy draft)", () => {
    const journal = buildPayrollJournalLines({
      periodLabel: "Maret 2026",
      gross: 1_000_000,
      net: 900_000,
      pph21: 50_000,
      bpjsKesEmployee: 20_000,
      bpjsTkEmployee: 30_000,
      bpjsKesEmployer: 0,
      bpjsTkEmployer: 0,
      accounts: ACCOUNTS,
    })

    expect(journal.balanced).toBe(true)
    expect(journal.lines.some((l) => l.accountCode === SYS_ACCOUNTS.BPJS_EMPLOYER_EXPENSE)).toBe(false)
  })

  it("reconstructs employer BPJS from gaji pokok for old drafts", () => {
    const fallback = resolveEmployerBpjsFromSalary(5_000_000, calculateBPJS)
    const full = calculateBPJS(5_000_000)
    expect(fallback.kesEmployer).toBe(full.kesehatanEmployer)
    expect(fallback.tkEmployer).toBe(
      full.jhtEmployer + full.jpEmployer + full.jkkEmployer + full.jkmEmployer
    )
  })
})

describe("SYS_ACCOUNTS mining payroll", () => {
  it("uses a dedicated employer expense code that does not collide with komisi 6110", () => {
    expect(SYS_ACCOUNTS.BPJS_EMPLOYER_EXPENSE).toBe("6130")
    expect(SYS_ACCOUNTS.SALARY_EXPENSE).toBe("6100")
  })
})

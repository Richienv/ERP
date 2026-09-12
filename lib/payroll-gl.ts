/**
 * Pure payroll GL helpers — no Prisma, no server imports.
 * Used by approvePayrollRun() and unit tests so journal math cannot drift.
 *
 * Accrual pattern (Indonesian SME / PSAK):
 *   DR  Beban Gaji (6100)                 = gross
 *   DR  Beban BPJS Perusahaan (6130)      = employer BPJS
 *     CR  Utang Gaji (2200)               = net
 *     CR  Utang PPh 21 (2310)             = PPh 21
 *     CR  Utang BPJS Kesehatan (2330)     = employee 1% + employer 4%
 *     CR  Utang BPJS Ketenagakerjaan (2320) = employee JHT+JP + employer JHT+JP+JKK+JKM
 */

export type PayrollJournalAccountCodes = {
  salaryExpense: string
  bpjsEmployerExpense: string
  payrollPayable: string
  pph21Payable: string
  bpjsKesPayable: string
  bpjsTkPayable: string
}

export type PayrollJournalInput = {
  periodLabel: string
  gross: number
  net: number
  pph21: number
  bpjsKesEmployee: number
  bpjsTkEmployee: number
  bpjsKesEmployer: number
  bpjsTkEmployer: number
  accounts: PayrollJournalAccountCodes
}

export type PayrollJournalLine = {
  accountCode: string
  debit: number
  credit: number
  description: string
}

export function roundRupiah(value: number): number {
  return Math.round(Number(value) || 0)
}

export function buildPayrollJournalLines(input: PayrollJournalInput): {
  lines: PayrollJournalLine[]
  totalDebit: number
  totalCredit: number
  balanced: boolean
} {
  const gross = roundRupiah(input.gross)
  const net = roundRupiah(input.net)
  const pph21 = roundRupiah(input.pph21)
  const kesEmp = roundRupiah(input.bpjsKesEmployee)
  const tkEmp = roundRupiah(input.bpjsTkEmployee)
  const kesEr = roundRupiah(input.bpjsKesEmployer)
  const tkEr = roundRupiah(input.bpjsTkEmployer)
  const employerTotal = kesEr + tkEr
  const label = input.periodLabel
  const a = input.accounts

  const lines: PayrollJournalLine[] = [
    {
      accountCode: a.salaryExpense,
      debit: gross,
      credit: 0,
      description: `Beban gaji ${label}`,
    },
  ]

  if (employerTotal > 0) {
    lines.push({
      accountCode: a.bpjsEmployerExpense,
      debit: employerTotal,
      credit: 0,
      description: `Beban BPJS perusahaan ${label}`,
    })
  }

  lines.push({
    accountCode: a.payrollPayable,
    debit: 0,
    credit: net,
    description: `Utang gaji ${label}`,
  })

  if (pph21 > 0) {
    lines.push({
      accountCode: a.pph21Payable,
      debit: 0,
      credit: pph21,
      description: `Utang PPh 21 ${label}`,
    })
  }

  const kesPayable = kesEmp + kesEr
  if (kesPayable > 0) {
    lines.push({
      accountCode: a.bpjsKesPayable,
      debit: 0,
      credit: kesPayable,
      description: `Utang BPJS Kesehatan ${label}`,
    })
  }

  const tkPayable = tkEmp + tkEr
  if (tkPayable > 0) {
    lines.push({
      accountCode: a.bpjsTkPayable,
      debit: 0,
      credit: tkPayable,
      description: `Utang BPJS Ketenagakerjaan ${label}`,
    })
  }

  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0)
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0)

  return {
    lines,
    totalDebit,
    totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) <= 1,
  }
}

export function resolveEmployerBpjsFromSalary(basicSalary: number, calculateBPJS: (salary: number) => {
  kesehatanEmployer: number
  jhtEmployer: number
  jpEmployer: number
  jkkEmployer: number
  jkmEmployer: number
}): { kesEmployer: number; tkEmployer: number } {
  const bpjs = calculateBPJS(basicSalary)
  return {
    kesEmployer: roundRupiah(bpjs.kesehatanEmployer),
    tkEmployer: roundRupiah(
      bpjs.jhtEmployer + bpjs.jpEmployer + bpjs.jkkEmployer + bpjs.jkmEmployer
    ),
  }
}

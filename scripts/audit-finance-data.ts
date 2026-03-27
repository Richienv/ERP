// scripts/audit-finance-data.ts
// Deep audit of finance data to find why reports show missing data
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function audit() {
  console.log('=== FINANCE DATA AUDIT ===\n')

  // 1. Journal Entries by status
  const jeByStatus = await prisma.journalEntry.groupBy({
    by: ['status'],
    _count: { id: true },
  })
  console.log('1. JOURNAL ENTRIES BY STATUS:')
  for (const row of jeByStatus) {
    console.log(`   ${row.status}: ${row._count.id}`)
  }
  const totalJE = jeByStatus.reduce((s, r) => s + r._count.id, 0)
  console.log(`   TOTAL: ${totalJE}\n`)

  // 2. Journal Lines summary
  const jlCount = await prisma.journalLine.count()
  const jlSum = await prisma.journalLine.aggregate({
    _sum: { debit: true, credit: true },
  })
  console.log(`2. JOURNAL LINES: ${jlCount} lines`)
  console.log(`   Total Debits:  Rp ${Number(jlSum._sum.debit || 0).toLocaleString('id-ID')}`)
  console.log(`   Total Credits: Rp ${Number(jlSum._sum.credit || 0).toLocaleString('id-ID')}\n`)

  // 3. Posted journal lines by account type
  const postedLines = await prisma.journalLine.findMany({
    where: { entry: { status: 'POSTED' } },
    include: { account: { select: { code: true, name: true, type: true } } },
  })
  const byType = new Map<string, { debit: number; credit: number; count: number }>()
  for (const line of postedLines) {
    const type = line.account.type
    const existing = byType.get(type) || { debit: 0, credit: 0, count: 0 }
    existing.debit += Number(line.debit)
    existing.credit += Number(line.credit)
    existing.count++
    byType.set(type, existing)
  }
  console.log('3. POSTED JOURNAL LINES BY ACCOUNT TYPE:')
  for (const [type, data] of byType) {
    console.log(`   ${type}: ${data.count} lines, DR ${data.debit.toLocaleString('id-ID')}, CR ${data.credit.toLocaleString('id-ID')}`)
  }
  console.log()

  // 4. GL Account balances (non-zero)
  const glAccounts = await prisma.gLAccount.findMany({
    orderBy: { code: 'asc' },
  })
  console.log('4. GL ACCOUNT BALANCES (stored .balance field):')
  let hasNonZero = false
  for (const acc of glAccounts) {
    const bal = Number(acc.balance)
    if (Math.abs(bal) > 0.01) {
      console.log(`   ${acc.code} ${acc.name} (${acc.type}): Rp ${bal.toLocaleString('id-ID')}`)
      hasNonZero = true
    }
  }
  if (!hasNonZero) console.log('   (ALL ZERO — balances not being updated)')
  console.log()

  // 5. Compute actual balances from journal lines (POSTED only)
  console.log('5. ACTUAL BALANCES FROM POSTED JOURNAL LINES:')
  const accountBalances = new Map<string, { code: string; name: string; type: string; debit: number; credit: number }>()
  for (const line of postedLines) {
    const key = line.accountId
    const existing = accountBalances.get(key) || {
      code: line.account.code,
      name: line.account.name,
      type: line.account.type,
      debit: 0,
      credit: 0,
    }
    existing.debit += Number(line.debit)
    existing.credit += Number(line.credit)
    accountBalances.set(key, existing)
  }
  const sorted = Array.from(accountBalances.values()).sort((a, b) => a.code.localeCompare(b.code))
  for (const acc of sorted) {
    const balance = acc.type === 'ASSET' || acc.type === 'EXPENSE'
      ? acc.debit - acc.credit
      : acc.credit - acc.debit
    if (Math.abs(balance) > 0.01) {
      console.log(`   ${acc.code} ${acc.name} (${acc.type}): Rp ${balance.toLocaleString('id-ID')}`)
    }
  }
  console.log()

  // 6. Invoices by type and status
  const invByTypeStatus = await prisma.invoice.groupBy({
    by: ['type', 'status'],
    _count: { id: true },
    _sum: { totalAmount: true, balanceDue: true },
  })
  console.log('6. INVOICES BY TYPE & STATUS:')
  for (const row of invByTypeStatus) {
    console.log(`   ${row.type} / ${row.status}: ${row._count.id} invoices, Total: Rp ${Number(row._sum.totalAmount || 0).toLocaleString('id-ID')}, Balance Due: Rp ${Number(row._sum.balanceDue || 0).toLocaleString('id-ID')}`)
  }
  console.log()

  // 7. Payments
  const payments = await prisma.payment.groupBy({
    by: ['method'],
    _count: { id: true },
    _sum: { amount: true },
  })
  console.log('7. PAYMENTS BY METHOD:')
  for (const row of payments) {
    console.log(`   ${row.method}: ${row._count.id} payments, Total: Rp ${Number(row._sum.amount || 0).toLocaleString('id-ID')}`)
  }
  const totalPayments = await prisma.payment.count()
  console.log(`   TOTAL: ${totalPayments}\n`)

  // 8. Check invoices and their linked journal entries
  const allInvoices = await prisma.invoice.findMany({
    where: { status: { notIn: ['DRAFT', 'CANCELLED', 'VOID'] } },
    select: { id: true, number: true, type: true, status: true, totalAmount: true, balanceDue: true,
      journalEntries: { select: { id: true, status: true } },
    },
  })
  const noJE = allInvoices.filter(inv => inv.journalEntries.length === 0)
  console.log(`8. INVOICES WITHOUT JOURNAL ENTRIES (non-draft):`)
  console.log(`   Total non-draft invoices: ${allInvoices.length}`)
  console.log(`   WITHOUT any journal entries: ${noJE.length}`)
  for (const inv of allInvoices) {
    console.log(`     ${inv.number} (${inv.type}/${inv.status}) Total: Rp ${Number(inv.totalAmount).toLocaleString('id-ID')}, Due: Rp ${Number(inv.balanceDue).toLocaleString('id-ID')}, JEs: ${inv.journalEntries.length}`)
  }
  console.log()

  // 9. Check payments and their linked journal entries
  const allPayments = await prisma.payment.findMany({
    select: { id: true, amount: true, method: true, invoiceId: true,
      journalEntry: true,
      invoice: { select: { number: true, type: true } },
    },
  })
  const noJEPayments = allPayments.filter(p => !p.journalEntry)
  console.log(`9. PAYMENTS WITHOUT JOURNAL ENTRIES:`)
  console.log(`   Total payments: ${allPayments.length}`)
  console.log(`   WITHOUT journal entry: ${noJEPayments.length}`)
  for (const p of allPayments) {
    console.log(`     Rp ${Number(p.amount).toLocaleString('id-ID')} (${p.method}) for ${p.invoice?.number || 'unknown'} — JE: ${p.journalEntry ? 'YES' : 'MISSING'}`)
  }
  console.log()

  // 10. Journal entries details (first 20)
  const recentJE = await prisma.journalEntry.findMany({
    take: 30,
    orderBy: { date: 'desc' },
    include: {
      lines: {
        include: { account: { select: { code: true, name: true, type: true } } },
      },
    },
  })
  console.log('10. RECENT JOURNAL ENTRIES (last 30):')
  for (const je of recentJE) {
    const totalDR = je.lines.reduce((s, l) => s + Number(l.debit), 0)
    const totalCR = je.lines.reduce((s, l) => s + Number(l.credit), 0)
    console.log(`   [${je.status}] ${je.refNo} | ${je.date.toISOString().slice(0, 10)} | "${je.description}" | DR ${totalDR.toLocaleString('id-ID')} / CR ${totalCR.toLocaleString('id-ID')}`)
    for (const line of je.lines) {
      const dr = Number(line.debit)
      const cr = Number(line.credit)
      console.log(`      ${line.account.code} ${line.account.name}: ${dr > 0 ? `DR ${dr.toLocaleString('id-ID')}` : `CR ${cr.toLocaleString('id-ID')}`}`)
    }
  }
  console.log()

  // 11. Check ALL GL accounts in database
  console.log('11. ALL GL ACCOUNTS:')
  for (const acc of glAccounts) {
    console.log(`   ${acc.code} | ${acc.name} | ${acc.type} | bal: Rp ${Number(acc.balance).toLocaleString('id-ID')}`)
  }

  await prisma.$disconnect()
}

audit().catch(e => {
  console.error(e)
  process.exit(1)
})

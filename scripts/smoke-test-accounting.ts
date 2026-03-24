import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Accounting Smoke Test ===\n')
  let passed = 0, failed = 0

  // Test 1: Non-DRAFT invoices have journal entries
  console.log('1. Checking invoice → journal entry connectivity...')
  const invoices = await prisma.invoice.findMany({
    where: { status: { notIn: ['DRAFT', 'CANCELLED'] } },
    select: { id: true, number: true, status: true }
  })
  for (const inv of invoices) {
    const je = await prisma.journalEntry.findFirst({ where: { reference: inv.number } })
    if (!je) { console.log(`   FAIL: ${inv.number} (${inv.status}) — no journal entry`); failed++ }
    else passed++
  }
  console.log(`   ${passed} OK, ${failed} missing\n`)

  // Test 2: Journal entries balanced
  console.log('2. Checking journal entry balance...')
  let bp = 0, bf = 0
  const entries = await prisma.journalEntry.findMany({
    where: { status: 'POSTED' }, include: { lines: true }
  })
  for (const e of entries) {
    const dr = e.lines.reduce((s, l) => s + Number(l.debit), 0)
    const cr = e.lines.reduce((s, l) => s + Number(l.credit), 0)
    if (Math.abs(dr - cr) > 0.01) { console.log(`   FAIL: ${e.reference} DR ${dr} != CR ${cr}`); bf++ }
    else bp++
  }
  console.log(`   ${bp} balanced, ${bf} imbalanced\n`)

  // Test 3: Account balance signs
  console.log('3. Checking GL account balance signs...')
  let sp = 0, sw = 0
  const accounts = await prisma.gLAccount.findMany()
  for (const a of accounts) {
    const b = Number(a.balance)
    if (b === 0) continue
    const isDebitNormal = ['ASSET', 'EXPENSE'].includes(a.type)
    if ((isDebitNormal && b < 0) || (!isDebitNormal && b < 0)) {
      console.log(`   WARN: ${a.code} ${a.name} (${a.type}) balance=${b}`); sw++
    } else sp++
  }
  console.log(`   ${sp} OK, ${sw} warnings\n`)

  const totalFail = failed + bf
  console.log('=== SUMMARY ===')
  console.log(`Passed: ${passed + bp + sp}`)
  console.log(`Failed: ${totalFail}`)
  console.log(`Warnings: ${sw}`)
  console.log(totalFail === 0 ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED')

  await prisma.$disconnect()
  process.exit(totalFail > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })

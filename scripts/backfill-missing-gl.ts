/**
 * scripts/backfill-missing-gl.ts
 *
 * Creates missing journal entries for existing invoices and payments
 * that were created without GL postings.
 *
 * Usage:
 *   npx tsx scripts/backfill-missing-gl.ts          # Dry run (preview only)
 *   npx tsx scripts/backfill-missing-gl.ts --apply   # Actually create entries
 */

import { PrismaClient, InvoiceType, InvoiceStatus } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = !process.argv.includes('--apply')

// System account codes (mirror lib/gl-accounts.ts)
const SYS = {
  CASH: '1000',
  BANK_BCA: '1110',
  AR: '1200',
  INVENTORY: '1300',
  PPN_MASUKAN: '1330',
  AP: '2000',
  PPN_KELUARAN: '2110',
  REVENUE: '4000',
  COGS: '5000',
  EXPENSE_DEFAULT: '6900',
}

interface JELine {
  accountCode: string
  debit: number
  credit: number
  description?: string
}

// Resolve account code to account ID, creating system account if needed
async function resolveAccount(code: string): Promise<string> {
  const account = await prisma.gLAccount.findFirst({ where: { code } })
  if (account) return account.id
  throw new Error(`GL Account ${code} not found — run seed-gl.ts first`)
}

// Create a journal entry with lines
async function createJournalEntry(data: {
  description: string
  date: Date
  reference: string
  invoiceId?: string
  paymentId?: string
  lines: JELine[]
}) {
  // Validate balance
  const totalDR = data.lines.reduce((s, l) => s + l.debit, 0)
  const totalCR = data.lines.reduce((s, l) => s + l.credit, 0)
  if (Math.abs(totalDR - totalCR) > 0.01) {
    throw new Error(`Unbalanced entry: DR ${totalDR} != CR ${totalCR} for ${data.reference}`)
  }

  // Resolve all account IDs
  const lineData = await Promise.all(
    data.lines.map(async (line) => ({
      accountId: await resolveAccount(line.accountCode),
      debit: line.debit,
      credit: line.credit,
      description: line.description,
    }))
  )

  const entry = await prisma.journalEntry.create({
    data: {
      date: data.date,
      description: data.description,
      reference: data.reference,
      status: 'POSTED',
      ...(data.invoiceId ? { invoiceId: data.invoiceId } : {}),
      ...(data.paymentId ? { paymentId: data.paymentId } : {}),
      lines: { create: lineData },
    },
  })

  // Update GL account balances
  for (const line of lineData) {
    const dr = Number(line.debit)
    const cr = Number(line.credit)
    const net = dr - cr
    if (Math.abs(net) > 0.001) {
      await prisma.gLAccount.update({
        where: { id: line.accountId },
        data: { balance: { increment: net } },
      })
    }
  }

  return entry.id
}

async function backfill() {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  GL BACKFILL ${DRY_RUN ? '(DRY RUN — pass --apply to execute)' : '(APPLYING CHANGES)'}`)
  console.log(`${'='.repeat(60)}\n`)

  // Ensure system accounts exist
  const systemCodes = Object.values(SYS)
  for (const code of systemCodes) {
    const exists = await prisma.gLAccount.findFirst({ where: { code } })
    if (!exists) {
      console.log(`  ⚠ Missing system account ${code} — run: npx tsx prisma/seed-gl.ts`)
    }
  }

  let created = 0
  let skipped = 0
  let errors = 0

  // ─── 1. INVOICES (ISSUED / OVERDUE) — AR Journal ──────────────────────

  console.log('\n── STEP 1: Customer Invoices (INV_OUT) → AR Journal ──\n')

  const arInvoices = await prisma.invoice.findMany({
    where: {
      type: 'INV_OUT',
      status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE', 'PAID'] },
    },
    include: {
      journalEntries: { select: { id: true } },
      items: true,
    },
    orderBy: { issueDate: 'asc' },
  })

  for (const inv of arInvoices) {
    if (inv.journalEntries.length > 0) {
      console.log(`  SKIP ${inv.number} — already has ${inv.journalEntries.length} JE(s)`)
      skipped++
      continue
    }

    const total = Number(inv.totalAmount)
    const tax = Number(inv.taxAmount)
    const subtotal = Number(inv.subtotal)

    const lines: JELine[] = [
      { accountCode: SYS.AR, debit: total, credit: 0, description: `Piutang ${inv.number}` },
      { accountCode: SYS.REVENUE, debit: 0, credit: subtotal, description: `Pendapatan ${inv.number}` },
    ]
    if (tax > 0) {
      lines[1].credit = subtotal // Revenue = subtotal only
      lines.push({ accountCode: SYS.PPN_KELUARAN, debit: 0, credit: tax, description: `PPN Keluaran ${inv.number}` })
    }

    console.log(`  ${DRY_RUN ? 'WOULD CREATE' : 'CREATING'} JE for ${inv.number} (${inv.status}): DR AR ${total.toLocaleString('id-ID')}, CR Rev ${subtotal.toLocaleString('id-ID')}${tax > 0 ? `, CR PPN ${tax.toLocaleString('id-ID')}` : ''}`)

    if (!DRY_RUN) {
      try {
        await createJournalEntry({
          description: `Penerbitan Invoice ${inv.number}`,
          date: inv.issueDate,
          reference: inv.number,
          invoiceId: inv.id,
          lines,
        })
        created++
      } catch (e: any) {
        console.log(`    ✗ ERROR: ${e.message}`)
        errors++
      }
    } else {
      created++
    }
  }

  // ─── 2. VENDOR BILLS (INV_IN) — AP Journal ──────────────────────────

  console.log('\n── STEP 2: Vendor Bills (INV_IN) → AP Journal ──\n')

  const apBills = await prisma.invoice.findMany({
    where: {
      type: 'INV_IN',
      status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE', 'PAID'] },
    },
    include: {
      journalEntries: { select: { id: true } },
      items: true,
    },
    orderBy: { issueDate: 'asc' },
  })

  for (const bill of apBills) {
    if (bill.journalEntries.length > 0) {
      console.log(`  SKIP ${bill.number} — already has ${bill.journalEntries.length} JE(s)`)
      skipped++
      continue
    }

    const total = Number(bill.totalAmount)
    const tax = Number(bill.taxAmount)
    const subtotal = Number(bill.subtotal)

    const lines: JELine[] = [
      { accountCode: SYS.EXPENSE_DEFAULT, debit: subtotal, credit: 0, description: `Beban ${bill.number}` },
    ]
    if (tax > 0) {
      lines.push({ accountCode: SYS.PPN_MASUKAN, debit: tax, credit: 0, description: `PPN Masukan ${bill.number}` })
    }
    lines.push({ accountCode: SYS.AP, debit: 0, credit: total, description: `Hutang ${bill.number}` })

    console.log(`  ${DRY_RUN ? 'WOULD CREATE' : 'CREATING'} JE for ${bill.number} (${bill.status}): DR Exp ${subtotal.toLocaleString('id-ID')}${tax > 0 ? `, DR PPN ${tax.toLocaleString('id-ID')}` : ''}, CR AP ${total.toLocaleString('id-ID')}`)

    if (!DRY_RUN) {
      try {
        await createJournalEntry({
          description: `Persetujuan Bill ${bill.number}`,
          date: bill.issueDate,
          reference: bill.number,
          invoiceId: bill.id,
          lines,
        })
        created++
      } catch (e: any) {
        console.log(`    ✗ ERROR: ${e.message}`)
        errors++
      }
    } else {
      created++
    }
  }

  // ─── 3. PAYMENTS — Cash/Bank Journal ──────────────────────────────────

  console.log('\n── STEP 3: Payments → Cash/Bank Journal ──\n')

  const allPayments = await prisma.payment.findMany({
    include: {
      journalEntries: { select: { id: true } },
      invoice: { select: { id: true, number: true, type: true, status: true } },
    },
    orderBy: { date: 'asc' },
  })

  for (const pmt of allPayments) {
    if (pmt.journalEntries.length > 0) {
      console.log(`  SKIP ${pmt.number} — already has ${pmt.journalEntries.length} JE(s)`)
      skipped++
      continue
    }

    const amount = Number(pmt.amount)
    const wht = Number(pmt.whtAmount || 0)
    const cashCode = SYS.BANK_BCA // Default to bank transfer
    const isAR = pmt.invoice?.type === 'INV_OUT'
    const isAP = pmt.invoice?.type === 'INV_IN'

    let lines: JELine[]

    if (isAR) {
      // AR Payment: DR Bank, CR AR
      const bankAmount = amount - wht
      lines = [
        { accountCode: cashCode, debit: bankAmount, credit: 0, description: `Penerimaan ${pmt.number}` },
      ]
      if (wht > 0) {
        lines.push({ accountCode: SYS.EXPENSE_DEFAULT, debit: wht, credit: 0, description: `PPh 23 dipotong customer` })
      }
      lines.push({ accountCode: SYS.AR, debit: 0, credit: amount, description: `Pelunasan ${pmt.invoice?.number}` })
    } else if (isAP) {
      // AP Payment: DR AP, CR Bank
      lines = [
        { accountCode: SYS.AP, debit: amount, credit: 0, description: `Pembayaran ${pmt.invoice?.number}` },
        { accountCode: cashCode, debit: 0, credit: amount - wht, description: `Transfer ${pmt.number}` },
      ]
      if (wht > 0) {
        lines.push({ accountCode: '2315', debit: 0, credit: wht, description: `PPh 23 dipotong` })
      }
    } else {
      // Unlinked payment — skip or create generic
      console.log(`  SKIP ${pmt.number} — no linked invoice, cannot determine type`)
      skipped++
      continue
    }

    console.log(`  ${DRY_RUN ? 'WOULD CREATE' : 'CREATING'} JE for ${pmt.number} (${isAR ? 'AR' : 'AP'}): Rp ${amount.toLocaleString('id-ID')}`)

    if (!DRY_RUN) {
      try {
        await createJournalEntry({
          description: `Pembayaran ${pmt.number} untuk ${pmt.invoice?.number || 'unknown'}`,
          date: pmt.date,
          reference: pmt.number,
          paymentId: pmt.id,
          lines,
        })
        created++
      } catch (e: any) {
        console.log(`    ✗ ERROR: ${e.message}`)
        errors++
      }
    } else {
      created++
    }
  }

  // ─── Summary ──────────────────────────────────────────────────────────

  console.log(`\n${'='.repeat(60)}`)
  console.log(`  SUMMARY`)
  console.log(`${'='.repeat(60)}`)
  console.log(`  Journal entries ${DRY_RUN ? 'to create' : 'created'}: ${created}`)
  console.log(`  Skipped (already had JE): ${skipped}`)
  console.log(`  Errors: ${errors}`)
  if (DRY_RUN && created > 0) {
    console.log(`\n  Run with --apply to create these entries:`)
    console.log(`  npx tsx scripts/backfill-missing-gl.ts --apply\n`)
  }

  await prisma.$disconnect()
}

backfill().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})

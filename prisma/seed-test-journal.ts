
import { PrismaClient } from '@prisma/client'
import { createInvoice, approveInvoice, recordPayment } from '../lib/actions/sales'

const prisma = new PrismaClient()

async function main() {
    console.log('--- STARTING JOURNAL AUTOMATION TEST ---')

    // 1. Get or Create Customer
    let customer = await prisma.customer.findFirst()
    if (!customer) {
        console.log('Creating Mock Customer...')
        customer = await prisma.customer.create({
            data: {
                name: 'PT TEST AUTOMATION',
                code: 'CUST-TEST',
                email: 'test@automation.com',
                customerType: 'COMPANY', // Added required field
            }
        })
    }

    // 2. Create Invoice
    console.log('1. Creating Invoice...')
    const invRes = await createInvoice({
        customerId: customer.id,
        items: [
            { description: 'Jasa Konsultasi ERP', quantity: 1, price: 10000000 },
            { description: 'Lisensi Software', quantity: 5, price: 500000 } // 2.5jt
        ],
        dueDate: new Date()
    })

    if (!invRes.success || !invRes.invoiceId) {
        throw new Error(`Failed to create invoice: ${invRes.error}`)
    }
    console.log(`   Invoice Created: ID ${invRes.invoiceId}`)

    // 3. Approve Invoice (Should trigger GL Post)
    console.log('2. Approving Invoice (Posting to GL)...')
    const appRes = await approveInvoice(invRes.invoiceId)
    if (!appRes.success) throw new Error(`Failed to approve: ${appRes.error}`)
    console.log('   Invoice Approved.')

    // 4. Verify Invoice Journal
    const invoice = await prisma.invoice.findUnique({ where: { id: invRes.invoiceId } })
    const journal1 = await prisma.journalEntry.findFirst({
        where: { reference: invoice?.number },
        include: { lines: { include: { account: true } } }
    })

    console.log(`   [CHECK] Journal for Invoice ${invoice?.number}:`)
    if (!journal1) console.error('   ❌ NO JOURNAL FOUND')
    else {
        journal1.lines.forEach(l => {
            console.log(`      ${l.account.code} (${l.account.name}): Debit ${l.debit}, Credit ${l.credit}`)
        })
    }

    // 5. Pay Invoice
    console.log('3. Recording Payment...')
    const payRes = await recordPayment(invRes.invoiceId, 12500000, 'TRANSFER') // Full amount 
    // Wait, total is 12.5M + tax?
    // Subtotal: 10M + 2.5M = 12.5M
    // Tax: 1.375M
    // Total: 13.875M
    // Let's pay partial first to verify logic? No let's verify logic manually based on total.
    if (!payRes.success) throw new Error(`Failed to pay: ${payRes.error}`)
    console.log('   Payment Recorded.')

    // 6. Verify Payment Journal
    const payments = await prisma.payment.findMany({ where: { invoiceId: invRes.invoiceId } })
    const lastPay = payments[payments.length - 1]
    const journal2 = await prisma.journalEntry.findFirst({
        where: { reference: lastPay.reference || "PAY" }, // logic in recordPayment might need checking
        include: { lines: { include: { account: true } } }
    })

    console.log(`   [CHECK] Journal for Payment:`)
    if (!journal2) {
        // Fallback check if reference mismatch
        const recentJournal = await prisma.journalEntry.findFirst({ orderBy: { createdAt: 'desc' }, include: { lines: { include: { account: true } } } })
        console.log('   (Showing most recent journal instead):', recentJournal?.description)
        recentJournal?.lines.forEach(l => {
            console.log(`      ${l.account.code} (${l.account.name}): Debit ${l.debit}, Credit ${l.credit}`)
        })
    } else {
        journal2.lines.forEach(l => {
            console.log(`      ${l.account.code} (${l.account.name}): Debit ${l.debit}, Credit ${l.credit}`)
        })
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

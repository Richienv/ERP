
import { PrismaClient } from '@prisma/client'
import { confirmPurchaseOrder } from '../lib/actions/procurement'

const prisma = new PrismaClient()

async function main() {
    console.log('--- STARTING PROCUREMENT JOURNAL AUTOMATION TEST ---')

    // 1. Get or Create Supplier
    let supplier = await prisma.supplier.findFirst()
    if (!supplier) {
        console.log('Creating Mock Supplier...')
        supplier = await prisma.supplier.create({
            data: {
                name: 'PT SUPPLIER ABC',
                code: 'SUP-TEST',
                email: 'supplier@abc.com'
            }
        })
    }

    // 2. Create Purchase Order (Mock)
    console.log('1. Creating Purchase Order...')
    const year = new Date().getFullYear()
    const count = await prisma.purchaseOrder.count()
    const poNumber = `PO-${year}-${String(count + 1).padStart(4, '0')}`

    const po = await prisma.purchaseOrder.create({
        data: {
            number: poNumber,
            supplierId: supplier.id,
            status: 'OPEN',
            totalAmount: 50000000, // 50jt
            paymentStatus: 'UNPAID',
            orderDate: new Date(),
            orderDate: new Date()
        }
    })
    console.log(`   PO Created: ID ${po.id}`)

    // 3. Confirm PO (Trigger Journal)
    console.log('2. Confirming PO (Receiving & Billing)...')
    const confirmRes = await confirmPurchaseOrder(po.id)
    if (!confirmRes.success) throw new Error(`Failed to confirm PO: ${confirmRes.error}`)
    console.log('   PO Confirmed.')

    // 4. Verify Journal
    const journal = await prisma.journalEntry.findFirst({
        where: { reference: po.number },
        include: { lines: { include: { account: true } } }
    })

    console.log(`   [CHECK] Journal for PO ${po.number}:`)
    if (!journal) console.error('   ❌ NO JOURNAL FOUND')
    else {
        journal.lines.forEach(l => {
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

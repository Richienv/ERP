
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Start seeding Sales Module...')

    // 1. Create Customer Categories
    const catGeneral = await prisma.customerCategory.upsert({
        where: { code: 'GEN' },
        update: {},
        create: { code: 'GEN', name: 'General', description: 'General Customers' }
    })

    const catVIP = await prisma.customerCategory.upsert({
        where: { code: 'VIP' },
        update: {},
        create: { code: 'VIP', name: 'VIP', description: 'High Value Customers' }
    })

    // 2. Create Customers
    // Use any to bypass strict enum checks if needed, but using correct strings now
    // Note: if runtime failure persists, ensure Prisma Client is regenerated.
    const cust1 = await (prisma.customer as any).upsert({
        where: { code: 'CUST-001' },
        update: {},
        create: {
            code: 'CUST-001',
            name: 'PT. Sejahtera Abadi',
            email: 'procurement@sejahtera.com',
            phone: '021-555-001',
            customerType: 'COMPANY',
            categoryId: catVIP.id,
            paymentTerm: 'NET_30',
            creditLimit: 100000000
        }
    })

    const cust2 = await (prisma.customer as any).upsert({
        where: { code: 'CUST-002' },
        update: {},
        create: {
            code: 'CUST-002',
            name: 'Toko Bangunan Jaya',
            email: 'tb_jaya@gmail.com',
            phone: '0812-333-444',
            customerType: 'INDIVIDUAL',
            categoryId: catGeneral.id,
            paymentTerm: 'CASH',
            creditLimit: 10000000
        }
    })

    // 3. Create Sales Orders & Invoices (to reflect revenue in GL)
    // Cleanup first
    await prisma.salesOrder.deleteMany({ where: { number: { in: ['SO-2024-001', 'SO-2024-002'] } } })
    await prisma.invoice.deleteMany({ where: { number: 'INV-2024-002' } })

    // Order 1: Confirmed
    const so1 = await (prisma.salesOrder as any).create({
        data: {
            number: 'SO-2024-001',
            customerId: cust1.id,
            status: 'CONFIRMED',
            orderDate: new Date(),
            paymentTerm: 'NET_30',
            subtotal: 50000000,
            taxAmount: 5500000,
            total: 55500000,
            items: {
                create: []
            }
        }
    })

    // IMPORTANT: Create Invoice for SO-2024-001 to hit Revenue GL
    // Cleanup first to avoid Unique Constraint
    await prisma.invoice.deleteMany({ where: { number: 'INV-2024-001' } })

    await (prisma.invoice as any).create({
        data: {
            number: 'INV-2024-001',
            type: 'INV_OUT',
            customerId: cust1.id,
            orderId: so1.id,
            issueDate: new Date(),
            // Making this overdue (5 days ago) to show up in dashboard Overdue list
            dueDate: new Date(new Date().setDate(new Date().getDate() - 5)),
            subtotal: 50000000,
            taxAmount: 5500000,
            totalAmount: 55500000,
            balanceDue: 55500000,
            status: 'OVERDUE' // Also setting status explicitly to OVERDUE for clarity
        }
    })

    // Order 2: Completed (Paid)
    const so2 = await (prisma.salesOrder as any).create({
        data: {
            number: 'SO-2024-002',
            customerId: cust2.id,
            status: 'COMPLETED',
            orderDate: new Date(),
            paymentTerm: 'CASH',
            subtotal: 5000000,
            taxAmount: 550000,
            total: 5550000
        }
    })

    // Invoice for SO 2
    await (prisma.invoice as any).create({
        data: {
            number: 'INV-2024-002',
            type: 'INV_OUT',
            customerId: cust2.id,
            orderId: so2.id,
            issueDate: new Date(),
            dueDate: new Date(),
            subtotal: 5000000,
            taxAmount: 550000,
            totalAmount: 5550000,
            balanceDue: 0, // Paid
            status: 'PAID'
        }
    })

    console.log('Seeding Sales finished.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

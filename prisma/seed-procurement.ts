
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Start seeding Procurement (Hutang) Data...')

    // 1. Create Supplier
    const supplier1 = await prisma.supplier.upsert({
        where: { code: 'SUP-001' },
        update: {},
        create: {
            code: 'SUP-001',
            name: 'PT. Bahan Baku Utama',
            contactName: 'Pak Budi',
            email: 'budi@bahanbaku.com',
            phone: '021-999-888',
            address: 'Kawasan Industri Cikarang',
            isActive: true
        }
    })

    // 2. Create Purchase Order (Upsert or Delete/Create)
    // Simple approach: Delete existing if any to avoid collision
    await prisma.invoice.deleteMany({ where: { number: 'BILL-2024-001' } }) // Clean up dependent invoice first
    await prisma.purchaseOrder.deleteMany({ where: { number: 'PO-2024-001' } })

    const po1 = await prisma.purchaseOrder.create({
        data: {
            number: 'PO-2024-001',
            supplierId: supplier1.id,
            status: 'OPEN',
            orderDate: new Date(),
            totalAmount: 200000000, // 200 Juta
            taxAmount: 22000000,
            netAmount: 222000000
        }
    })

    // 3. Create Invoice (Hutang / Bill)
    // Make sure it matches INV_IN type
    await prisma.invoice.create({
        data: {
            number: 'BILL-2024-001',
            type: 'INV_IN', // Supplier Invoice / Bill
            supplierId: supplier1.id, // Only connect supplier
            orderId: po1.id, // Connect PO
            issueDate: new Date(),
            dueDate: new Date(new Date().setDate(new Date().getDate() + 7)), // Due next week (Upcoming)
            subtotal: 200000000,
            taxAmount: 22000000,
            totalAmount: 222000000,
            balanceDue: 222000000, // Unpaid
            status: 'ISSUED'
        }
    })

    console.log('Seeding Procurement finished.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

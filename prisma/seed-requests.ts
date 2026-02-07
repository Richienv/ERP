
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Seeding Purchase Requests...')

    // 1. Get an Employee (Assignee/Requester)
    const employee = await prisma.employee.findFirst({
        where: { status: 'ACTIVE' }
    })

    if (!employee) {
        console.error('❌ No active employee found. Cannot seed requests.')
        return
    }

    // 2. Get some Products
    const products = await prisma.product.findMany({
        take: 3
    })

    if (products.length === 0) {
        console.error('❌ No products found. Cannot seed requests.')
        return
    }

    // 3. Create Tasks
    const tasks = [
        {
            title: `Purchase Request: ${products[0].name}`,
            priority: 'HIGH',
            relatedId: products[0].id,
            notes: `Urgent restock needed for ${products[0].name}. Production halted.`
        },
        {
            title: `Purchase Request: ${products[1]?.name || 'Unknown Item'}`,
            priority: 'MEDIUM',
            relatedId: products[1]?.id,
            notes: `Restocking ${products[1]?.name} for next month.`
        },
        {
            title: `Purchase Request: Office Supplies`,
            priority: 'LOW',
            relatedId: null, // Generic
            notes: `Paper, pens, and toner.`
        }
    ]

    for (const t of tasks) {
        await prisma.employeeTask.create({
            data: {
                employeeId: employee.id,
                title: t.title,
                type: 'PURCHASE_REQUEST',
                status: 'PENDING',
                priority: t.priority as any,
                relatedId: t.relatedId
                // Removed 'notes' field here if it doesn't exist in schema, but wait...
                // Does EmployeeTask have notes? In Step 3073, I saw it DOES NOT have notes.
                // But I'm writing a seed. If I write 'notes', it will fail if field missing.
                // I checked schema in Step 3073... NO NOTES.
                // So I must NOT write notes. I'll put notes in title or skip it.
                // Wait, I fixed `procurement.ts` to use `title` as notes.
                // I will append notes to title for now or just skip.
            }
        })
    }

    console.log(`✅ Created ${tasks.length} Purchase Requests for ${employee.firstName}`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

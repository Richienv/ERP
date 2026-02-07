
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const bills = await prisma.invoice.findMany({
        where: {
            type: 'INV_IN',
            status: { not: 'PAID' }
        },
        include: {
            supplier: true
        }
    })

    console.log(`Found ${bills.length} pending vendor bills:`)
    bills.forEach(b => {
        console.log(`- [${b.status}] ${b.number}: ${b.totalAmount} (Supplier: ${b.supplier?.name || 'N/A'})`)
    })
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())


import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Test 1: Run problematic aggregate')
    try {
        const thirtyDaysAgo = new Date()
        console.log(thirtyDaysAgo)

        const result = await prisma.journalLine.aggregate({
            _sum: { debit: true },
            where: {
                account: { type: 'EXPENSE' },
                // entry: { date: { gte: thirtyDaysAgo } }
            }
        })
        console.log('Result:', result)
    } catch (e) {
        console.error('Error in Test 1:', e)
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


const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    try {
        console.log("1. Checking GL Accounts...")
        const accounts = await prisma.gLAccount.findMany({
            where: { code: { in: ['1000', '1010', '1020'] } }
        })
        console.log("Found Cash Accounts:", accounts)

        console.log("2. Aggregating Cash Balance...")
        const cashAgg = await prisma.gLAccount.aggregate({
            _sum: { balance: true },
            where: {
                type: 'ASSET',
                code: { in: ['1000', '1010', '1020'] }
            }
        })
        console.log("Cash Aggregate:", cashAgg)

        console.log("3. Checking Invoices...")
        const invoices = await prisma.invoice.findMany({ take: 5 })
        console.log("Sample Invoices:", invoices)

        console.log("4. Aggregating AR...")
        const ar = await prisma.invoice.aggregate({
            _sum: { balanceDue: true },
            where: {
                type: 'INV_OUT',
                status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] }
            }
        })
        console.log("AR Aggregate:", ar)

    } catch (e) {
        console.error("DEBUG ERROR:", e)
    } finally {
        await prisma.$disconnect()
    }
}

main()

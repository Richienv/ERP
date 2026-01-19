
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    try {
        // Try accessing via delegates. Note casing might vary so checking keys might be safer but let's try standard first
        // Use try-catch blocks for each measure to identify which specific part fails
        try {
            const glCount = await prisma.gLAccount.count()
            console.log("GLAccounts:", glCount)
        } catch (e) {
            console.log("GLAccounts Check Failed:", e.message)
        }

        try {
            const invCount = await prisma.invoice.count()
            console.log("Invoices:", invCount)
        } catch (e) {
            console.log("Invoices Check Failed:", e.message)
        }

    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}

main()

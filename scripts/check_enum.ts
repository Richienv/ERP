
import { PrismaClient, InvoiceStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log("Checking InvoiceStatus enum in Prisma Client...")
    console.log("Available statuses:", Object.keys(InvoiceStatus))

    if (!Object.values(InvoiceStatus).includes('DISPUTED' as any)) {
        console.error("❌ 'DISPUTED' is NOT in the Prisma Client InvoiceStatus enum. You must restart the server/regenerate client.")
    } else {
        console.log("✅ 'DISPUTED' is present in Prisma Client.")
    }

    console.log("\nAttempting to query database with 'DISPUTED' status...")
    try {
        const bills = await prisma.invoice.findMany({
            where: {
                status: { in: ['DRAFT', 'DISPUTED'] as any }
            },
            take: 1
        })
        console.log("✅ Query successful. Found bills:", bills.length)
    } catch (error: any) {
        console.error("❌ Query failed:", error.message)
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())

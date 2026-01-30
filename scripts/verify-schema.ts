
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    try {
        console.log("Verifying Product schema...")
        // 1. Check if we can find a product and if it has the manualAlert field
        const product = await prisma.product.findFirst()

        if (!product) {
            console.log("No products found to verify.")
            return
        }

        console.log("Found product:", product.id)
        console.log("manualAlert value:", (product as any).manualAlert)

        // 2. Try to update it (reverting to current value)
        const currentVal = (product as any).manualAlert || false
        console.log("Attempting update...")

        await prisma.product.update({
            where: { id: product.id },
            data: { manualAlert: !currentVal }
        })

        // revert
        await prisma.product.update({
            where: { id: product.id },
            data: { manualAlert: currentVal }
        })

        console.log("SUCCESS: Database has manualAlert column and it is writable.")

    } catch (e) {
        console.error("FAILURE: Database verification failed.")
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}

main()

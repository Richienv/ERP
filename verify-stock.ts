
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🔍 Verifying Stock Levels...')

    const products = await prisma.product.findMany({
        where: { code: 'MAT-COT-30' },
        include: { stockLevels: true }
    })

    if (products.length === 0) {
        console.log('❌ Product MAT-COT-30 not found.')
    } else {
        const p = products[0]
        console.log(`Product: ${p.name} (${p.code})`)
        console.log(`Stock Levels:`, p.stockLevels)
        const total = p.stockLevels.reduce((sum, sl) => sum + Number(sl.quantity), 0)
        console.log(`Total Stock Calculated: ${total}`)
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())


import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Running Gap Analysis Query...')
    try {
        const products = await prisma.product.findMany({
            where: { isActive: true },
            include: {
                stockLevels: {
                    include: { warehouse: true }
                },
                category: true,
                purchaseOrderItems: {
                    where: {
                        purchaseOrder: { status: { in: ['ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED'] } }
                    },
                    include: {
                        purchaseOrder: {
                            include: { supplier: true }
                        }
                    },
                    orderBy: {
                        purchaseOrder: { expectedDate: 'asc' }
                    }
                },
                supplierItems: {
                    where: { isPreferred: true },
                    include: { supplier: { select: { name: true, contactName: true } } },
                    take: 1
                },
                workOrders: {
                    where: { status: { in: ['PLANNED', 'IN_PROGRESS'] } }
                },
                alternativeProduct: true,
                // 5. BOM & Demand (Critical for loop)
                BOMItem: {
                    include: {
                        bom: {
                            include: {
                                product: {
                                    include: {
                                        workOrders: {
                                            where: { status: { in: ['PLANNED', 'IN_PROGRESS'] } }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        })
        console.log(`Success! Found ${products.length} products.`)
    } catch (e) {
        console.error('Error executing query:')
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}

main()

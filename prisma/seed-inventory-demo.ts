
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Starting Inventory Demo Reset...')

    const supplier = await prisma.supplier.findFirst()
    if (!supplier) {
        console.error('❌ No supplier found. Please seed suppliers first.')
        return
    }

    const warehouse = await prisma.warehouse.findFirst()
    if (!warehouse) {
        console.error('❌ No warehouse found. Please seed warehouses first.')
        return
    }

    // 1. Define Items
    const items = [
        {
            name: 'Benang Katun',
            code: 'MAT-001-DEMO',
            categoryName: 'Raw Material',
            status: 'REQUEST_NEEDED', // Custom flag for our logic
            color: 'White'
        },
        {
            name: 'Pewarna Merah',
            code: 'MAT-002-DEMO',
            categoryName: 'Chemicals',
            status: 'RECEIVE_NEEDED', // Custom flag
            color: 'Red'
        }
    ]

    // 2. Clean up existing data for these items
    for (const item of items) {
        console.log(`🧹 Cleaning up ${item.name}...`)

        // Find product
        const product = await prisma.product.findFirst({
            where: { code: item.code }
        })

        if (product) {
            // Delete related PO Items
            await prisma.purchaseOrderItem.deleteMany({
                where: { productId: product.id }
            })

            // Delete Stock Levels
            await prisma.stockLevel.deleteMany({
                where: { productId: product.id }
            })

            // Delete Inventory Transactions (FIX: Delete transactions first)
            await prisma.inventoryTransaction.deleteMany({
                where: { productId: product.id }
            })

            // Delete BOM Items if any
            await prisma.bOMItem.deleteMany({
                where: { materialId: product.id }
            })

            // Delete Supplier Items
            await prisma.supplierProduct.deleteMany({
                where: { productId: product.id }
            })

            // Delete the product itself
            await prisma.product.delete({
                where: { id: product.id }
            })
        }
    }

    // 3. Create fresh data
    for (const item of items) {
        console.log(`✨ Creating fresh ${item.name}...`)

        // Ensure Category Exists
        let category = await prisma.category.findFirst({ where: { name: item.categoryName } })
        if (!category) {
            // Create with a random code to satisfy unique constraint
            category = await prisma.category.create({
                data: {
                    name: item.categoryName,
                    code: `CAT-${Math.random().toString(36).substring(7).toUpperCase()}`
                }
            })
        }

        // Create Product
        const product = await prisma.product.create({
            data: {
                name: item.name,
                code: item.code,
                description: `Demo Item for ${item.name}`,
                unit: item.color === 'Red' ? 'Liter' : 'Roll',
                costPrice: 50000,
                sellingPrice: 0,
                minStock: 100, // High min stock to force gap
                isActive: true,
                categoryId: category.id,
                leadTime: 3
            }
        })

        // Supplier Link
        await prisma.supplierProduct.create({
            data: {
                supplierId: supplier.id,
                productId: product.id,
                price: 45000,
                leadTime: 3,
                isPreferred: true
            }
        })

        // Create Stock Level (Empty to force gap)
        await prisma.stockLevel.create({
            data: {
                productId: product.id,
                warehouseId: warehouse.id,
                quantity: 0,
                availableQty: 0
            }
        })

        // 4. Specific State Logic
        if (item.status === 'RECEIVE_NEEDED') {
            // Create an OPEN PO for this item
            console.log(`📦 Creating Purchase Order for ${item.name}...`)
            await prisma.purchaseOrder.create({
                data: {
                    number: `PO-DEMO-${Math.floor(Math.random() * 1000)}`,
                    supplierId: supplier.id,
                    status: 'OPEN',
                    orderDate: new Date(),
                    // FIX: Quantity enough to cover MinStock (100)
                    totalAmount: 45000 * 150,
                    items: {
                        create: {
                            productId: product.id,
                            quantity: 150,
                            unitPrice: 45000,
                            totalPrice: 45000 * 150
                        }
                    }
                }
            })
        }
    }

    console.log('✅ Inventory Demo Reset Complete!')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

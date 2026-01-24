
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('📉 Starting COMPLETE Gap Scenario Reset...')

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

    // 1. Define 10 New Items
    const newItems = [
        // CRITICAL (Stock 0)
        { name: 'Cotton Yarn 40s', code: 'MAT-YARN-40', category: 'Raw Material', unit: 'Roll', stock: 0, min: 100, cost: 45000, lead: 7, gap: true },
        { name: 'Buttons Black 15mm', code: 'ACC-BTN-BLK', category: 'Accessories', unit: 'Gross', stock: 0, min: 200, cost: 25000, lead: 3, gap: true },

        // LOW STOCK (Needs Restock)
        { name: 'Red Dye Grade A', code: 'CHEM-DYE-RED-A', category: 'Chemicals', unit: 'Liter', stock: 10, min: 50, cost: 120000, lead: 5, gap: true },
        { name: 'Nylon Thread 200m', code: 'MAT-TH-NYL', category: 'Raw Material', unit: 'Cone', stock: 20, min: 100, cost: 15000, lead: 4, gap: true },
        { name: 'Sewing Machine Oil', code: 'SUP-OIL-MACHINE', category: 'Supplies', unit: 'Liter', stock: 2, min: 10, cost: 85000, lead: 2, gap: true },
        { name: 'Packaging Box L', code: 'SUP-BOX-L', category: 'Supplies', unit: 'Pcs', stock: 50, min: 500, cost: 3500, lead: 3, gap: true },

        // HEALTHY (No Action)
        { name: 'Blue Dye Grade B', code: 'CHEM-DYE-BLU-B', category: 'Chemicals', unit: 'Liter', stock: 200, min: 50, cost: 90000, lead: 5, gap: false },
        { name: 'Zippers 20cm', code: 'ACC-ZIP-20', category: 'Accessories', unit: 'Pcs', stock: 500, min: 100, cost: 1200, lead: 3, gap: false },
        { name: 'Label Tags', code: 'SUP-LBL-TAG', category: 'Supplies', unit: 'Roll', stock: 300, min: 50, cost: 15000, lead: 2, gap: false },

        // INCOMING (PO Exists)
        { name: 'Polyester Fabric', code: 'MAT-FAB-POLY', category: 'Raw Material', unit: 'Roll', stock: 10, min: 100, cost: 55000, lead: 10, gap: false, incoming: true }
    ]

    // 2. FETCH AND DELETE ALL PRODUCTS (Aggressive Cleanup)
    console.log('🔥 Fetching ALL existing products for cleanup...')
    const allProducts = await prisma.product.findMany({ select: { id: true, code: true, name: true } })

    for (const p of allProducts) {
        console.log(`🧹 Deleting ${p.name} (${p.code})...`)

        // Delete Dependencies
        await prisma.purchaseOrderItem.deleteMany({ where: { productId: p.id } })
        await prisma.stockLevel.deleteMany({ where: { productId: p.id } })
        await prisma.inventoryTransaction.deleteMany({ where: { productId: p.id } })
        await prisma.stockAuditItem.deleteMany({ where: { productId: p.id } })
        await prisma.qualityInspection.deleteMany({ where: { materialId: p.id } })
        await prisma.workOrder.deleteMany({ where: { productId: p.id } })
        // Added BOM Item deletion
        await prisma.bOMItem.deleteMany({ where: { materialId: p.id } })
        await prisma.supplierProduct.deleteMany({ where: { productId: p.id } })

        // Delete Product
        await prisma.product.delete({ where: { id: p.id } })
    }

    console.log('✨ Creating 10 New Fresh Items...')

    // 3. Create New Data
    for (const item of newItems) {

        // Ensure Category Exists
        let category = await prisma.category.findFirst({ where: { name: item.category } })
        if (!category) {
            category = await prisma.category.create({
                data: {
                    name: item.category,
                    code: `CAT-${item.category.substring(0, 3).toUpperCase()}`
                }
            })
        }

        // Create Product
        const product = await prisma.product.create({
            data: {
                name: item.name,
                code: item.code,
                description: `Demo Item for ${item.name}`,
                unit: item.unit,
                costPrice: item.cost,
                sellingPrice: 0,
                minStock: item.min,
                isActive: true,
                categoryId: category.id,
                leadTime: item.lead,
                manualBurnRate: item.gap ? 5 : 0 // Add fake demand for "Requested Needed"
            }
        })

        // Supplier Link
        await prisma.supplierProduct.create({
            data: {
                supplierId: supplier.id,
                productId: product.id,
                price: item.cost,
                leadTime: item.lead,
                isPreferred: true
            }
        })

        // Create Stock
        await prisma.stockLevel.create({
            data: {
                productId: product.id,
                warehouseId: warehouse.id,
                quantity: item.stock,
                availableQty: item.stock
            }
        })

        // Create Incoming PO if needed
        if (item.incoming) {
            const qty = item.min * 2
            await prisma.purchaseOrder.create({
                data: {
                    number: `PO-DEMO-${item.code.split('-').pop()}`,
                    supplierId: supplier.id,
                    status: 'OPEN',
                    orderDate: new Date(),
                    expectedDate: new Date(Date.now() + 86400000), // Tomorrow
                    totalAmount: qty * item.cost,
                    items: {
                        create: {
                            productId: product.id,
                            quantity: qty,
                            unitPrice: item.cost,
                            totalPrice: qty * item.cost,
                            receivedQty: 0
                        }
                    }
                }
            })
            console.log(`✅ Created ${item.name} with INCOMING PO`)
        } else {
            console.log(`✅ Created ${item.name} (Stock: ${item.stock})`)
        }
    }

    console.log('🎉 Reset Complete: 10 New Items Ready!')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

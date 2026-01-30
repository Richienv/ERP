'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// ==========================================
// GET PRODUCTS FOR PO CREATION
// ==========================================
export async function getProductsForPO() {
    try {
        const products = await prisma.product.findMany({
            where: { isActive: true },
            select: {
                id: true,
                name: true,
                code: true,
                unit: true,
                sellingPrice: true,
                costPrice: true,
                supplierItems: {
                    include: {
                        supplier: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        })

        return products.map(p => ({
            id: p.id,
            name: p.name,
            code: p.code,
            unit: p.unit,
            // Try to find a cost, prefer supplier price, then internal cost, then 0
            defaultPrice: p.supplierItems[0]?.price ? Number(p.supplierItems[0].price) : Number(p.costPrice)
        }))
    } catch (error) {
        console.error("Error fetching products:", error)
        return []
    }
}

// ==========================================
// CREATE PURCHASE ORDER
// ==========================================
export async function createPurchaseOrder(data: {
    supplierId: string
    expectedDate?: Date
    notes?: string
    items: {
        productId: string
        quantity: number
        unitPrice: number
    }[]
}) {
    try {
        if (!data.supplierId) throw new Error("Supplier is required")
        if (!data.items || data.items.length === 0) throw new Error("At least one item is required")

        // Generate PO Number
        const date = new Date()
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
        const poNumber = `PO-${year}${month}-${random}`

        // Calculate Totals
        const totalAmount = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)

        // Create PO
        const po = await prisma.purchaseOrder.create({
            data: {
                number: poNumber,
                supplierId: data.supplierId,
                status: 'OPEN',
                orderDate: new Date(),
                expectedDate: data.expectedDate,
                totalAmount,
                // Create Items
                items: {
                    create: data.items.map(item => ({
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice: item.quantity * item.unitPrice
                    }))
                }
            }
        })

        revalidatePath('/procurement/orders')
        return { success: true, poId: po.id, number: poNumber }

    } catch (error: any) {
        console.error("Error creating PO:", error)
        return { success: false, error: error.message || "Failed to create Purchase Order" }
    }
}

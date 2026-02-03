'use server'

import { prisma, safeQuery, withRetry } from "@/lib/db"
import { revalidatePath, unstable_cache } from "next/cache"
import { FALLBACK_PRODUCTS } from "@/lib/db-fallbacks"

// ==========================================
// GET PRODUCTS FOR PO CREATION
// ==========================================
export const getProductsForPO = unstable_cache(
    async () => {
        const { data: products, error } = await safeQuery<any[]>(
            () => withRetry(() => prisma.product.findMany({
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
            })),
            FALLBACK_PRODUCTS
        )

        if (error) {
            console.error("Error fetching products for PO:", error.message)
        }

        return products.map((p: any) => ({
            id: p.id,
            name: p.name,
            code: p.code,
            unit: p.unit,
            defaultPrice: p.supplierItems?.[0]?.price ? Number(p.supplierItems[0].price) : Number(p.costPrice)
        }))
    },
    ['po-products'],
    { revalidate: 300, tags: ['inventory', 'products', 'procurement'] }
)

// ==========================================
// CREATE PURCHASE ORDER
// ==========================================
export async function createPurchaseOrder(data: {
    supplierId: string
    expectedDate?: Date
    notes?: string
    paymentTerms?: string
    shippingAddress?: string
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
        const subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
        const taxAmount = subtotal * 0.11 // PPN 11%
        const totalAmount = subtotal + taxAmount

        // Create PO with correct status from ProcurementStatus enum
        const po = await prisma.purchaseOrder.create({
            data: {
                number: poNumber,
                supplierId: data.supplierId,
                status: 'PO_DRAFT', // Correct enum value
                orderDate: new Date(),
                expectedDate: data.expectedDate,
                totalAmount: subtotal,
                taxAmount,
                netAmount: totalAmount,
                // Create Items
                items: {
                    create: data.items.map(item => ({
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice: item.quantity * item.unitPrice
                    }))
                }
            },
            include: {
                supplier: true,
                items: {
                    include: { product: true }
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

// ==========================================
// GET PO DETAILS FOR PDF
// ==========================================
export async function getPODetails(poId: string) {
    try {
        const po = await prisma.purchaseOrder.findUnique({
            where: { id: poId },
            include: {
                supplier: true,
                items: {
                    include: { product: true }
                }
            }
        })

        if (!po) return null

        return {
            id: po.id,
            number: po.number,
            status: po.status,
            orderDate: po.orderDate,
            expectedDate: po.expectedDate,
            supplier: {
                name: po.supplier.name,
                address: po.supplier.address,
                phone: po.supplier.phone,
                email: po.supplier.email
            },
            items: po.items.map(item => ({
                productName: item.product.name,
                productCode: item.product.code,
                unit: item.product.unit,
                quantity: item.quantity,
                unitPrice: Number(item.unitPrice),
                totalPrice: Number(item.totalPrice)
            })),
            subtotal: Number(po.totalAmount),
            taxAmount: Number(po.taxAmount),
            netAmount: Number(po.netAmount)
        }
    } catch (error) {
        console.error("Error fetching PO details:", error)
        return null
    }
}

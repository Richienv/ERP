'use server'

import { withPrismaAuth, safeQuery, withRetry, prisma } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { revalidatePath, unstable_cache } from "next/cache"
import { FALLBACK_PRODUCTS } from "@/lib/db-fallbacks"

// ==========================================
// GET PRODUCTS FOR PO CREATION
// ==========================================
export const getProductsForPO = unstable_cache(
    async () => {
        try {
            // Prisma Client
            const products = await prisma.product.findMany({
                where: { isActive: true },
                orderBy: { name: 'asc' },
                include: {
                    supplierItems: {
                        select: {
                            price: true,
                            supplierId: true
                        }
                    }
                }
            })

            if (!products) return []

            return products.map((p) => ({
                id: p.id,
                name: p.name,
                code: p.code,
                unit: p.unit,
                defaultPrice: p.supplierItems?.[0]?.price ? Number(p.supplierItems[0].price) : Number(p.costPrice)
            }))
        } catch (error: any) {
            console.error("Error fetching products for PO:", error.message)
            return FALLBACK_PRODUCTS
        }
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

        // Prepare Payload for RPC
        const payload = {
            number: poNumber,
            supplierId: data.supplierId,
            expectedDate: data.expectedDate ? data.expectedDate.toISOString() : null,
            totalAmount,
            taxAmount,
            netAmount: totalAmount,
            notes: data.notes || null,
            items: data.items.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice
            }))
        }

        // Call Supabase RPC
        const { data: result, error } = await supabase.rpc('create_purchase_order_v2', { payload })

        if (error) {
            throw new Error(error.message)
        }

        const typedResult = result as any

        if (!typedResult.success) {
            throw new Error(typedResult.error || "Failed to create PO via RPC")
        }

        revalidatePath('/procurement/orders')
        return { success: true, poId: typedResult.poId, number: typedResult.number }

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
        return await withPrismaAuth(async (prisma) => {
            const po = await prisma.purchaseOrder.findUnique({
                where: { id: poId },
                include: {
                    supplier: true,
                    items: {
                        include: { product: true }
                    },
                    purchaseRequests: {
                        take: 1,
                        include: {
                            requester: { select: { firstName: true, lastName: true } },
                            approver: { select: { firstName: true, lastName: true } }
                        }
                    }
                }
            })

            if (!po) return null

            const pr = po.purchaseRequests[0]
            const requesterName = pr?.requester
                ? `${pr.requester.firstName} ${pr.requester.lastName}`
                : 'System'
            const approverName = pr?.approver
                ? `${pr.approver.firstName} ${pr.approver.lastName}`
                : '-'

            return {
                id: po.id,
                supplierId: po.supplierId, // Added for edit mode
                number: po.number,
                status: po.status,
                orderDate: po.orderDate,
                expectedDate: po.expectedDate,
                requester: requesterName, // New field
                approver: approverName,   // New field
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
        })
    } catch (error) {
        console.error("Error fetching PO details:", error)
        return null
    }
}

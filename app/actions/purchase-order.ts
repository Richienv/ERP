'use server'

import { withPrismaAuth, prisma } from "@/lib/db"
import { FALLBACK_PRODUCTS } from "@/lib/db-fallbacks"
import { createClient } from "@/lib/supabase/server"

// ==========================================
// GET PRODUCTS FOR PO CREATION
// ==========================================
export async function getProductsForPO() {
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
}

// ==========================================
// CREATE PURCHASE ORDER
// ==========================================
export async function createPurchaseOrder(data: {
    supplierId: string
    expectedDate?: Date
    notes?: string
    paymentTerms?: string
    shippingAddress?: string
    includeTax?: boolean
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
        const taxAmount = (data.includeTax ?? true) ? (subtotal * 0.11) : 0
        const totalAmount = subtotal + taxAmount

        // Get authenticated user
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const userId = user?.id

        // Create PO with items using Prisma transaction
        const po = await prisma.$transaction(async (tx) => {
            const purchaseOrder = await tx.purchaseOrder.create({
                data: {
                    number: poNumber,
                    supplierId: data.supplierId,
                    expectedDate: data.expectedDate || null,
                    totalAmount,
                    taxAmount,
                    netAmount: totalAmount,
                    status: 'PO_DRAFT',
                    createdBy: userId || null,
                    items: {
                        create: data.items.map(item => ({
                            productId: item.productId,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            totalPrice: item.quantity * item.unitPrice,
                        })),
                    },
                },
            })

            // Create initial PO event
            await tx.purchaseOrderEvent.create({
                data: {
                    purchaseOrderId: purchaseOrder.id,
                    status: 'PO_DRAFT',
                    changedBy: userId || purchaseOrder.id,
                    action: 'CREATE',
                    notes: 'Purchase Order created',
                },
            })

            return purchaseOrder
        })

        return { success: true, poId: po.id, number: po.number }

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

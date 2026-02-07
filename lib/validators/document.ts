
import { z } from "zod"

export const LineItemSchema = z.object({
    sku: z.string().min(1).max(50).regex(/^[A-Z0-9\-]+$/, "SKU must be uppercase alphanumeric"),
    description: z.string().min(1).max(500),
    qty: z.number().int().positive().max(999999),
    unit_price: z.number().positive(),
    total: z.number().positive()
})

export const PurchaseOrderSchema = z.object({
    po_number: z.string().min(1).max(50).regex(/^[A-Z0-9\-]+$/),
    date: z.string(), // ISO date string
    vendor: z.object({
        name: z.string().min(1).max(200),
        address: z.string().min(1).max(500),
        tax_id: z.string().regex(/^[0-9\-]+$/),
        contact: z.string().min(1).max(100),
        email: z.string().email()
    }),
    ship_to: z.object({
        warehouse: z.string().min(1).max(100),
        address: z.string().min(1).max(500)
    }),
    line_items: z.array(LineItemSchema).min(1).max(1000),
    summary: z.object({
        subtotal: z.number(),
        tax_rate: z.number().min(0).max(100),
        tax_amount: z.number(),
        discount: z.number().optional().default(0),
        total: z.number(),
        currency: z.string().regex(/^[A-Z]{3}$/),
        notes: z.string().max(1000).optional()
    })
}).refine(data => {
    // Validate Calculations
    const calcSubtotal = data.line_items.reduce((sum, item) => sum + item.total, 0)
    const subtotalDiff = Math.abs(calcSubtotal - data.summary.subtotal)

    if (subtotalDiff > 0.01) return false
    return true
}, {
    message: "Subtotal calculation mismatch",
    path: ["summary", "subtotal"]
})

export type PurchaseOrderData = z.infer<typeof PurchaseOrderSchema>

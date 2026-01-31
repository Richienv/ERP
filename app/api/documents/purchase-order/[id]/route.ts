
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { DocumentService } from "@/lib/services/document-service"
import { PurchaseOrderSchema } from "@/lib/validators/document"

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const poId = params.id

        // 1. Fetch Data
        const po = await prisma.purchaseOrder.findUnique({
            where: { id: poId },
            include: {
                supplier: true,
                items: { include: { product: true } }
            }
        })

        if (!po) {
            return NextResponse.json({ error: "Purchase Order not found" }, { status: 404 })
        }

        // 2. Map to Template Data Schema
        // Note: Some fields are mocked/defaulted because schema doesn't have them yet (e.g. tax_id, address split)
        const templateData = {
            po_number: po.number,
            date: po.orderDate.toISOString().split('T')[0],
            vendor: {
                name: po.supplier.name,
                address: po.supplier.address || "No Address Provided",
                tax_id: "00-000-000.0-000.000", // Placeholder if not in DB
                contact: po.supplier.contactName || po.supplier.name,
                email: po.supplier.email || "no-email@vendor.com"
            },
            ship_to: {
                warehouse: "Main Warehouse", // Default
                address: "Jl. Industri Raya No. 123\nKawasan Industri Pulo Gadung\nJakarta Timur 13920" // Company Address
            },
            line_items: po.items.map(item => ({
                sku: item.product.code || "SKU-" + item.productId.substring(0, 6).toUpperCase(),
                description: item.product.name,
                qty: item.quantity,
                unit_price: Number(item.unitPrice),
                total: Number(item.totalPrice)
            })),
            summary: {
                subtotal: Number(po.totalAmount),
                tax_rate: 11, // PPN 11% Standard
                tax_amount: Math.round(Number(po.totalAmount) * 0.11), // Simple calc with rounding
                discount: 0,
                total: Math.round(Number(po.totalAmount) * 1.11),
                currency: "IDR",
                notes: "Generated from ERP System"
            }
        }

        // 3. Generate PDF
        const pdfBuffer = await DocumentService.generatePDF("purchase_order", templateData)

        // 4. Return Data
        return new NextResponse(pdfBuffer as any, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="PO-${po.number}.pdf"`
            }
        })

    } catch (error: any) {
        console.error("PDF Generation Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

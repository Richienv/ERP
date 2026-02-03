
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { DocumentService } from "@/lib/services/document-service"
import { formatRupiah } from "@/lib/utils"
import { PurchaseOrderSchema } from "@/lib/validators/document"

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const poId = params.id

        const disposition = req.nextUrl.searchParams.get("disposition") || "attachment"
        const contentDisposition = disposition === "inline" ? "inline" : "attachment"

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
        // Read Query Params for Template Format (plain vs standard)
        // format=cop -> Use Letterhead (No Header/Footer generated)
        // format=plain -> Standard (Generate Header/Footer)
        const format = req.nextUrl.searchParams.get("format") || "standard"
        const use_letterhead = format === "cop" ? false : true // logic: if 'cop' (pre-printed), don't print header/footer (use_letterhead=false for generation)
        // Wait, naming. 'use_letterhead' usually means "I WANT to use my digital letterhead".
        // Let's call it 'print_decoration'.
        const print_decoration = format !== "cop"

        const templateData = {
            config: {
                print_decoration: print_decoration
            },
            po_number: po.number,
            date: po.orderDate.toISOString().split('T')[0],
            vendor: {
                name: po.supplier.name,
                address: po.supplier.address || "No Address Provided",
                tax_id: "00-000-000.0-000.000",
                contact: po.supplier.contactName || po.supplier.name,
                email: po.supplier.email || "no-email@vendor.com"
            },
            ship_to: {
                warehouse: "Main Warehouse",
                address: "Jl. Industri Raya No. 123\nKawasan Industri Pulo Gadung\nJakarta Timur 13920"
            },
            line_items: po.items.map(item => ({
                sku: item.product.code || "SKU-" + item.productId.substring(0, 6).toUpperCase(),
                description: item.product.name,
                qty: item.quantity,
                unit_price: Number(item.unitPrice),
                unit_price_formatted: formatRupiah(Number(item.unitPrice), false),
                total: Number(item.totalPrice),
                total_formatted: formatRupiah(Number(item.totalPrice), false)
            })),
            summary: {
                subtotal: Number(po.totalAmount),
                subtotal_formatted: formatRupiah(Number(po.totalAmount)),
                tax_rate: 11,
                tax_amount: Math.round(Number(po.totalAmount) * 0.11),
                tax_formatted: formatRupiah(Math.round(Number(po.totalAmount) * 0.11)),
                discount: 0,
                total: Math.round(Number(po.totalAmount) * 1.11),
                total_formatted: formatRupiah(Math.round(Number(po.totalAmount) * 1.11)),
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
                "Content-Disposition": `${contentDisposition}; filename="PO-${po.number}.pdf"`,
                "Cache-Control": "no-store"
            }
        })

    } catch (error: any) {
        console.error("PDF Generation Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

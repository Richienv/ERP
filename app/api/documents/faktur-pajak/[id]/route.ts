import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db"
import { DocumentService } from "@/lib/services/document-service"
import { formatRupiah } from "@/lib/utils"

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params
        const invoiceId = params.id

        const disposition = req.nextUrl.searchParams.get("disposition") || "attachment"
        const contentDisposition = disposition === "inline" ? "inline" : "attachment"

        // 1. Authenticate
        const supabase = await createClient()
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // 2. Fetch Invoice data
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                customer: {
                    select: {
                        name: true,
                        npwp: true,
                    },
                },
                items: {
                    include: {
                        product: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
        })

        if (!invoice) {
            return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
        }

        // Get customer address
        const customerAddress = await prisma.customerAddress.findFirst({
            where: { customerId: invoice.customerId || undefined },
            select: { address1: true, kabupaten: true, provinsi: true },
        })

        const buyerAddress = customerAddress
            ? [customerAddress.address1, customerAddress.kabupaten, customerAddress.provinsi]
                  .filter(Boolean)
                  .join(", ")
            : ""

        // 3. Map to template data
        const subtotal = Number(invoice.subtotal)
        const taxAmount = Number(invoice.taxAmount)
        const totalAmount = Number(invoice.totalAmount)

        const templateData = {
            number: invoice.number,
            date: invoice.issueDate.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
            }),
            seller: {
                name: "PT. Textile ERP",
                npwp: "",
                address: "",
            },
            buyer: {
                name: invoice.customer?.name || "—",
                npwp: invoice.customer?.npwp || "—",
                address: buyerAddress,
            },
            items: invoice.items.map((item) => ({
                description: item.product?.name || item.description,
                qty: Number(item.quantity),
                unit_price: formatRupiah(Number(item.unitPrice), false),
                total: formatRupiah(Number(item.amount), false),
            })),
            summary: {
                dpp: formatRupiah(subtotal, false),
                ppn: formatRupiah(taxAmount, false),
                total: formatRupiah(totalAmount, false),
            },
        }

        // 4. Generate PDF
        const pdfBuffer = await DocumentService.generatePDF(
            "faktur_pajak",
            templateData
        )

        // 5. Return PDF
        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `${contentDisposition}; filename="FP-${invoice.number}.pdf"`,
            },
        })
    } catch (error) {
        console.error("[Faktur Pajak API] Error:", error)
        return NextResponse.json(
            { error: "Failed to generate Faktur Pajak" },
            { status: 500 }
        )
    }
}

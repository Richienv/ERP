import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db"
import { DocumentService } from "@/lib/services/document-service"

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params
        const orderId = params.id

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

        // 2. Fetch Sales Order data
        const order = await prisma.salesOrder.findUnique({
            where: { id: orderId },
            include: {
                customer: {
                    select: {
                        name: true,
                        email: true,
                    },

                },
                items: {
                    include: {
                        product: {
                            select: {
                                code: true,
                                name: true,
                                unit: true,
                            },
                        },
                    },
                },
            },
        })

        if (!order) {
            return NextResponse.json({ error: "Sales Order not found" }, { status: 404 })
        }

        // Get customer address
        const customerAddress = await prisma.customerAddress.findFirst({
            where: { customerId: order.customerId },
            select: { address1: true, kabupaten: true, provinsi: true },
        })

        const address = customerAddress
            ? [customerAddress.address1, customerAddress.kabupaten, customerAddress.provinsi]
                  .filter(Boolean)
                  .join(", ")
            : ""

        // 3. Map to template data
        const templateData = {
            number: `SJ-${order.number}`,
            date: new Date().toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
            }),
            customer: {
                name: order.customer.name,
                address,
            },
            sales_order: order.number,
            expedition: "",
            items: order.items.map((item) => ({
                description: item.product.name,
                code: item.product.code,
                qty: item.quantity,
                unit: item.product.unit || "pcs",
            })),
            notes: order.notes || "",
            company: {
                name: "PT. Textile ERP",
                address: "",
            },
        }

        // 4. Generate PDF
        const pdfBuffer = await DocumentService.generatePDF(
            "surat_jalan",
            templateData
        )

        // 5. Return PDF
        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `${contentDisposition}; filename="SJ-${order.number}.pdf"`,
            },
        })
    } catch (error) {
        console.error("[Surat Jalan API] Error:", error)
        return NextResponse.json(
            { error: "Failed to generate Surat Jalan" },
            { status: 500 }
        )
    }
}

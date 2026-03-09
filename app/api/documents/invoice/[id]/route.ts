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

        // 2. Fetch Invoice data with items, customer, supplier
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                customer: {
                    select: {
                        id: true,
                        name: true,
                        npwp: true,
                    },
                },
                supplier: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                    },
                },
                items: {
                    include: {
                        product: {
                            select: {
                                name: true,
                                code: true,
                            },
                        },
                    },
                },
            },
        })

        if (!invoice) {
            return NextResponse.json(
                { error: "Invoice tidak ditemukan" },
                { status: 404 }
            )
        }

        // 3. Get buyer address (from CustomerAddress if customer-type invoice)
        let buyerAddress = ""
        if (invoice.customerId) {
            const addr = await prisma.customerAddress.findFirst({
                where: { customerId: invoice.customerId, isPrimary: true },
                select: {
                    address1: true,
                    kabupaten: true,
                    provinsi: true,
                },
            })
            if (addr) {
                buyerAddress = [addr.address1, addr.kabupaten, addr.provinsi]
                    .filter(Boolean)
                    .join(", ")
            }
        } else if (invoice.supplier?.address) {
            buyerAddress = invoice.supplier.address
        }

        // 4. Map to template data
        const subtotal = Number(invoice.subtotal)
        const taxAmount = Number(invoice.taxAmount)
        const discountAmount = Number(invoice.discountAmount)
        const totalAmount = Number(invoice.totalAmount)

        const party = invoice.customer || invoice.supplier
        const partyNpwp = invoice.customer?.npwp || ""

        const templateData = {
            number: invoice.number,
            status: invoice.status,
            type: invoice.type,
            issue_date: invoice.issueDate.toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "long",
                year: "numeric",
            }),
            due_date: invoice.dueDate.toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "long",
                year: "numeric",
            }),
            seller: {
                name: "PT. Textile ERP Indonesia",
                npwp: "00.000.000.0-000.000",
                address: "Jakarta, Indonesia",
            },
            buyer: {
                name: party?.name || "\u2014",
                npwp: partyNpwp || "\u2014",
                address: buyerAddress || "\u2014",
            },
            items: invoice.items.map((item, idx) => ({
                no: idx + 1,
                description: item.product?.name || item.description,
                code: item.product?.code || "",
                qty: Number(item.quantity),
                unit_price: formatRupiah(Number(item.unitPrice), false),
                total: formatRupiah(Number(item.amount), false),
            })),
            summary: {
                dpp: formatRupiah(subtotal, false),
                ppn: formatRupiah(taxAmount, false),
                discount: formatRupiah(discountAmount, false),
                total: formatRupiah(totalAmount, false),
            },
            payment: {
                terms: "",
                bank: "",
                account_number: "",
                account_name: "",
            },
        }

        // 5. Generate PDF
        const pdfBuffer = await DocumentService.generatePDF(
            "invoice",
            templateData
        )

        // 6. Return PDF
        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `${contentDisposition}; filename="INV-${invoice.number}.pdf"`,
            },
        })
    } catch (error: unknown) {
        console.error("[Invoice PDF API] Error:", error)
        const message =
            error instanceof Error ? error.message : "Unknown error"
        return new NextResponse(
            `<html><body><h1>Error generating invoice PDF</h1><p>${message}</p></body></html>`,
            { status: 500, headers: { "Content-Type": "text/html" } }
        )
    }
}

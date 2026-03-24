import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db"
import { DocumentService } from "@/lib/services/document-service"

/**
 * Format number as Indonesian thousands-separated string for Typst template.
 * Returns plain number string WITHOUT "Rp" prefix — the template adds the prefix.
 * Example: 5000000 → "5.000.000"
 */
function formatNumber(amount: number): string {
    if (isNaN(amount)) return "0"
    return new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount)
}

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
                        paymentTerm: true,
                    },
                },
                supplier: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        paymentTerm: true,
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
        const subtotal = Number(invoice.subtotal ?? 0)
        const taxAmount = Number(invoice.taxAmount ?? 0)
        const discountAmount = Number(invoice.discountAmount ?? 0)
        const totalAmount = Number(invoice.totalAmount ?? 0)

        const party = invoice.customer || invoice.supplier
        const partyNpwp = invoice.customer?.npwp || ""

        // Map PaymentTerm enum to human-readable Indonesian text
        const paymentTermRaw = invoice.customer?.paymentTerm || invoice.supplier?.paymentTerm || ""
        const PAYMENT_TERM_LABELS: Record<string, string> = {
            CASH: "Tunai",
            NET_15: "Net 15 Hari",
            NET_30: "Net 30 Hari",
            NET_45: "Net 45 Hari",
            NET_60: "Net 60 Hari",
            NET_90: "Net 90 Hari",
            COD: "Cash on Delivery",
        }
        const paymentTermLabel = PAYMENT_TERM_LABELS[paymentTermRaw] || ""

        const templateData = {
            number: invoice.number ?? "",
            status: invoice.status ?? "DRAFT",
            type: invoice.type ?? "INV_OUT",
            issue_date: invoice.issueDate
                ? invoice.issueDate.toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                })
                : "\u2014",
            due_date: invoice.dueDate
                ? invoice.dueDate.toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                })
                : "\u2014",
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
            items: (invoice.items ?? []).map((item, idx) => ({
                no: idx + 1,
                description: item.product?.name || item.description || "\u2014",
                code: item.product?.code || "",
                qty: Number(item.quantity ?? 0),
                unit_price: formatNumber(Number(item.unitPrice ?? 0)),
                total: formatNumber(Number(item.amount ?? 0)),
            })),
            summary: {
                dpp: formatNumber(subtotal),
                ppn: formatNumber(taxAmount),
                discount: formatNumber(discountAmount),
                total: formatNumber(totalAmount),
            },
            payment: {
                terms: paymentTermLabel,
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
        return NextResponse.json(
            { error: `Gagal membuat PDF invoice: ${message}` },
            { status: 500 }
        )
    }
}

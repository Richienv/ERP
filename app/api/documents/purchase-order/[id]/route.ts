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
        const params = await props.params;
        const poId = params.id

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

        // 2. Fetch Data using Prisma
        const po = await prisma.purchaseOrder.findUnique({
            where: { id: poId },
            include: {
                supplier: {
                    select: {
                        name: true,
                        address: true,
                        email: true,
                        contactName: true
                    }
                },
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                code: true,
                                name: true
                            }
                        }
                    }
                }
            }
        })

        if (!po) {
            return NextResponse.json({ error: "Purchase Order not found" }, { status: 404 })
        }

        // 3. Map to Template Data Schema
        const format = req.nextUrl.searchParams.get("format") || "standard"
        const print_decoration = format !== "cop"

        // Calculate values with fallback for legacy data.
        const subtotal = Number(po.totalAmount || 0)
        const taxAmount = po.taxAmount == null ? (subtotal * 0.11) : Number(po.taxAmount)
        const netAmount = po.netAmount == null ? (subtotal + taxAmount) : Number(po.netAmount)
        const taxRate = subtotal > 0 ? Math.round((taxAmount / subtotal) * 10000) / 100 : 0

        // Null-safe supplier and items
        const supplier = po.supplier || { name: "Vendor Belum Dipilih", address: "-", email: "-", contactName: "-" }

        const templateData = {
            config: {
                print_decoration: print_decoration
            },
            po_number: po.number,
            date: new Date(po.orderDate).toISOString().split('T')[0],
            vendor: {
                name: supplier.name || "Unknown Vendor",
                address: supplier.address || "No Address Provided",
                tax_id: "00-000-000.0-000.000",
                contact: supplier.contactName || supplier.name || "Unknown",
                email: supplier.email || "no-email@vendor.com"
            },
            ship_to: {
                warehouse: "Main Warehouse",
                address: "Jl. Industri Raya No. 123\nKawasan Industri Pulo Gadung\nJakarta Timur 13920"
            },
            line_items: (po.items || []).map((item: any) => ({
                sku: item.product?.code || "SKU-" + String(item.productId).substring(0, 6).toUpperCase(),
                description: item.product?.name || "Unknown Product",
                qty: item.quantity,
                unit_price: Number(item.unitPrice),
                unit_price_formatted: formatRupiah(Number(item.unitPrice), false),
                total: Number(item.totalPrice),
                total_formatted: formatRupiah(Number(item.totalPrice), false)
            })),
            summary: {
                subtotal: subtotal,
                subtotal_formatted: formatRupiah(subtotal),
                tax_rate: taxRate,
                tax_amount: taxAmount,
                tax_formatted: formatRupiah(taxAmount),
                discount: 0,
                total: netAmount,
                total_formatted: formatRupiah(netAmount),
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

        // Return a user-friendly HTML error page instead of raw JSON
        const message = error?.message || "Unknown error"
        const isTypstMissing = message.includes("Typst binary not found") || message.includes("ENOENT")
        const userMessage = isTypstMissing
            ? "PDF generator (Typst) belum terinstall di server. Hubungi administrator."
            : `Gagal membuat dokumen PDF: ${message}`

        const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Error</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fafafa}
.box{border:2px solid #000;padding:2rem 3rem;max-width:480px;text-align:center;background:#fff;box-shadow:4px 4px 0 #000}
h2{margin:0 0 .5rem;font-size:1.1rem}p{color:#666;font-size:.9rem;margin:0}</style></head>
<body><div class="box"><h2>&#9888; Gagal Generate PDF</h2><p>${userMessage}</p></div></body></html>`

        return new NextResponse(html, {
            status: 500,
            headers: { "Content-Type": "text/html; charset=utf-8" }
        })
    }
}

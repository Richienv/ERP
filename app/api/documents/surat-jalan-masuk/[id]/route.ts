import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db"
import { DocumentService } from "@/lib/services/document-service"

const prismaAny = prisma as any

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params
        const grnId = params.id

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

        // 2. Fetch GRN with relations
        const grn = await prismaAny.goodsReceivedNote.findUnique({
            where: { id: grnId },
            include: {
                purchaseOrder: {
                    include: {
                        supplier: {
                            select: {
                                name: true,
                                address: true,
                            },
                        },
                    },
                },
                warehouse: {
                    select: {
                        name: true,
                    },
                },
                receivedBy: {
                    select: {
                        firstName: true,
                        lastName: true,
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

        if (!grn) {
            return NextResponse.json({ error: "Surat Jalan Masuk not found" }, { status: 404 })
        }

        const receivedByName = `${grn.receivedBy.firstName} ${grn.receivedBy.lastName || ""}`.trim()

        // 3. Map to template data
        const templateData = {
            number: grn.number,
            date: new Date(grn.receivedDate).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
            }),
            supplier: {
                name: grn.purchaseOrder.supplier.name,
                address: grn.purchaseOrder.supplier.address || "",
            },
            purchase_order: grn.purchaseOrder.number,
            warehouse: grn.warehouse.name,
            received_by: receivedByName,
            items: grn.items.map((item: any) => ({
                description: item.product.name,
                code: item.product.code,
                qty_ordered: item.quantityOrdered,
                qty_received: item.quantityReceived,
                qty_accepted: item.quantityAccepted,
                qty_rejected: item.quantityRejected,
                unit: item.product.unit || "pcs",
            })),
            notes: grn.notes || "",
            company: {
                name: "PT. Textile ERP",
                address: "",
            },
        }

        // 4. Generate PDF
        const pdfBuffer = await DocumentService.generatePDF(
            "surat_jalan_masuk",
            templateData
        )

        // 5. Return PDF
        return new NextResponse(pdfBuffer as unknown as BodyInit, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `${contentDisposition}; filename="${grn.number}.pdf"`,
            },
        })
    } catch (error) {
        console.error("[Surat Jalan Masuk API] Error:", error)
        return NextResponse.json(
            { error: "Failed to generate Surat Jalan Masuk" },
            { status: 500 }
        )
    }
}

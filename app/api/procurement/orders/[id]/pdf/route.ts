import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { generatePoPdf } from "@/lib/pdf/po-pdf"
import { getAuthzUser } from "@/lib/authz"

/**
 * GET /api/procurement/orders/[id]/pdf
 *
 * Streams a Typst-rendered Purchase Order PDF as a downloadable attachment.
 * Filename uses the human-readable PO number (e.g. `PO-2026-001.pdf`) when
 * available, falling back to the UUID otherwise.
 *
 * Errors return a JSON `{ error }` payload with status 500 — the client
 * `<TypstPdfButton>` surfaces this via toast.
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params
    try {
        await getAuthzUser()
        const pdf = await generatePoPdf(prisma, id)
        const po = await prisma.purchaseOrder.findUnique({
            where: { id },
            select: { number: true },
        })
        const filename = po?.number ? `${po.number}.pdf` : `${id}.pdf`
        return new NextResponse(pdf as unknown as BodyInit, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "no-store",
            },
        })
    } catch (e: unknown) {
        console.error("[PO PDF API]", e)
        const msg = e instanceof Error ? e.message : "Gagal membuat PDF"
        if (msg === "Unauthorized") {
            return NextResponse.json({ error: msg }, { status: 401 })
        }
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

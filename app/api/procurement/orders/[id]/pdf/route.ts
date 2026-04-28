import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getAuthzUser } from "@/lib/authz"
import { generateSnapshot, logDistribution } from "@/lib/documents/document-service"
import { downloadDocument } from "@/lib/storage/document-storage"

/**
 * GET /api/procurement/orders/[id]/pdf
 *
 * Streams the latest DocumentSnapshot PDF for a PO. If no snapshot exists
 * yet (pre-Phase-A POs), lazily back-fills one on first access. An
 * in-memory mutex per entity prevents N concurrent requests from each
 * triggering a parallel render.
 *
 * Errors return a JSON `{ error }` payload — `<TypstPdfButton>` surfaces
 * via toast.
 */

const backfillLocks = new Map<string, Promise<unknown>>()

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params
    try {
        const user = await getAuthzUser()

        // 1. Find latest snapshot
        let latest = await prisma.documentSnapshot.findFirst({
            where: { type: "PO", entityId: id, archivedAt: null },
            orderBy: { version: "desc" },
        })

        // 2. Lazy backfill (mutex-guarded so parallel requests share one render)
        if (!latest) {
            const inflight = backfillLocks.get(id)
            if (inflight) {
                await inflight
            } else {
                const promise = generateSnapshot({
                    type: "PO",
                    entityId: id,
                    trigger: "BACKFILL",
                    actorId: user.id,
                }).finally(() => backfillLocks.delete(id))
                backfillLocks.set(id, promise)
                await promise
            }
            latest = await prisma.documentSnapshot.findFirst({
                where: { type: "PO", entityId: id },
                orderBy: { version: "desc" },
            })
        }

        if (!latest) {
            return NextResponse.json(
                { error: "Snapshot generation failed" },
                { status: 500 },
            )
        }

        // 3. Best-effort distribution log (don't block the download if it fails)
        await logDistribution({
            snapshotId: latest.id,
            action: "DOWNLOAD",
            actorId: user.id,
        }).catch((err) => console.error("[PO PDF] distribution log failed:", err))

        // 4. Stream the bytes
        const buffer = await downloadDocument(latest.storageKey)
        const po = await prisma.purchaseOrder.findUnique({
            where: { id },
            select: { number: true },
        })
        const filename = po?.number
            ? `${po.number}-v${latest.version}.pdf`
            : `${id}-v${latest.version}.pdf`

        return new NextResponse(buffer as unknown as BodyInit, {
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

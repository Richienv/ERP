import { execSync } from "child_process"
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import type { PrismaClient } from "@prisma/client"

/**
 * Generate a Purchase Order PDF using the Typst template at
 * `templates/purchase_order/main.typ`.
 *
 * Returns the PDF as a Buffer ready to be written to an HTTP response.
 *
 * Used by the API route `app/api/procurement/orders/[id]/pdf` (Phase C).
 *
 * TODO: convert to async exec post-demo for non-blocking generation.
 * `execSync` blocks the Node.js event loop and is not suitable for
 * production scale — use `child_process.spawn` with a Promise wrapper
 * (see lib/services/document-service.ts for an async pattern).
 */
export async function generatePoPdf(
    prisma: PrismaClient,
    poId: string,
): Promise<Buffer> {
    const po = await prisma.purchaseOrder.findUnique({
        where: { id: poId },
        include: {
            supplier: true,
            items: { include: { product: true } },
        },
    })
    if (!po) throw new Error(`PO ${poId} not found`)

    const templatePath = join(
        process.cwd(),
        "templates",
        "purchase_order",
        "main.typ",
    )

    const data = JSON.stringify({
        po_number: po.number,
        date: po.orderDate
            ? new Date(po.orderDate).toISOString().slice(0, 10)
            : "",
        vendor: {
            name: po.supplier?.name ?? "Unknown Vendor",
            address: po.supplier?.address ?? "",
        },
        line_items: po.items.map((i) => ({
            sku: i.product?.code ?? "",
            description: i.product?.name ?? "",
            qty: Number(i.quantity),
            unit_price: Number(i.unitPrice ?? 0),
            total: Number(i.totalPrice ?? 0),
        })),
        summary: {
            subtotal: Number(po.totalAmount ?? 0),
            tax_amount: Number(po.taxAmount ?? 0),
            total: Number(po.netAmount ?? po.totalAmount ?? 0),
            currency: "IDR",
        },
    })

    const tmpDir = mkdtempSync(join(tmpdir(), "po-pdf-"))
    const dataPath = join(tmpDir, "data.json")
    const outPath = join(tmpDir, "out.pdf")

    try {
        writeFileSync(dataPath, data)
        execSync(
            `typst compile --input data="${dataPath}" "${templatePath}" "${outPath}"`,
            { stdio: "pipe" },
        )
        return readFileSync(outPath)
    } finally {
        // Always cleanup tmpDir to prevent orphan files on disk
        rmSync(tmpDir, { recursive: true, force: true })
    }
}

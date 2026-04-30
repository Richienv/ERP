/**
 * GET /api/procurement/requests/template
 *
 * Streams an XLSX file containing the canonical PR import template
 * (2 sheets: "PR Header" + "PR Items"). Used by ImportPRsDialog so users
 * always grab the latest header layout (kept in sync with the column
 * aliases + bulkImportPurchaseRequests validators).
 */
import { NextResponse } from "next/server"
import { generatePRTemplate } from "@/lib/exports/pr-template"

export async function GET() {
    try {
        const buffer = generatePRTemplate()
        // Wrap Node Buffer into a Uint8Array view so NextResponse accepts it
        // as a BodyInit on both the Node and Edge runtimes.
        const body = new Uint8Array(buffer)
        return new NextResponse(body, {
            status: 200,
            headers: {
                "Content-Type":
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": 'attachment; filename="template-pr.xlsx"',
                "Cache-Control": "no-store",
            },
        })
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to generate template"
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

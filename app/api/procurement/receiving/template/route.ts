/**
 * GET /api/procurement/receiving/template
 *
 * Streams an XLSX file containing the canonical GRN bulk-import template
 * (2 sheets: GRN Header + GRN Items). Used by the ImportGRNsDialog
 * "Download Template" link so users always grab the latest header layout
 * (kept in sync with bulkImportGRNs aliases).
 */
import { NextResponse } from "next/server"
import { generateGRNTemplate } from "@/lib/exports/grn-template"

export async function GET() {
    try {
        const buffer = generateGRNTemplate()
        // Wrap Node Buffer into a Uint8Array view so NextResponse accepts it
        // as a BodyInit on both the Node and Edge runtimes.
        const body = new Uint8Array(buffer)
        return new NextResponse(body, {
            status: 200,
            headers: {
                "Content-Type":
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": 'attachment; filename="template-grn.xlsx"',
                "Cache-Control": "no-store",
            },
        })
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to generate template"
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

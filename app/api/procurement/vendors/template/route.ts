/**
 * GET /api/procurement/vendors/template
 *
 * Streams an XLSX file containing the canonical vendor import template.
 * Used by the ImportVendorsDialog "Download Template" link so users always
 * grab the latest header layout (kept in sync with bulkImportVendors aliases).
 */
import { NextResponse } from "next/server"
import { generateVendorTemplate } from "@/lib/exports/vendor-template"

export async function GET() {
    try {
        const buffer = generateVendorTemplate()
        // Wrap Node Buffer into a Uint8Array view so NextResponse accepts it
        // as a BodyInit on both the Node and Edge runtimes.
        const body = new Uint8Array(buffer)
        return new NextResponse(body, {
            status: 200,
            headers: {
                "Content-Type":
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": 'attachment; filename="template-vendor.xlsx"',
                "Cache-Control": "no-store",
            },
        })
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to generate template"
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

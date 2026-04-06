import { NextResponse } from "next/server"
import { fixCNPartialInvoices } from "@/lib/actions/finance-dcnotes"

/**
 * One-time data fix: correct invoices wrongly set to PARTIAL by CN/DN settlements.
 * GET /api/system/fix-cn-partial
 *
 * Safe to call multiple times — only fixes invoices with 0 payments + CN/DN settlements.
 * Remove this route after the fix is confirmed.
 */
export async function GET() {
    const result = await fixCNPartialInvoices()
    return NextResponse.json(result)
}

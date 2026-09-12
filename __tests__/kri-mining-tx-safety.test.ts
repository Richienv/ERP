/**
 * Guardrail: KRI mining money-loop actions must not nest withPrismaAuth.
 *
 * Nested interactive transactions deadlock the Supabase transaction pooler
 * (outer holds a connection; inner waits for another). Live E2E of
 * GRN → bill → pay → payroll 6130 fails as timeouts / "journal gagal".
 *
 * Logic-only: reads source, no database.
 */
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

function src(rel: string) {
    return fs.readFileSync(path.join(process.cwd(), rel), "utf8")
}

function sliceFn(text: string, startMarker: string, endMarker: string) {
    const start = text.indexOf(startMarker)
    const end = text.indexOf(endMarker, start + startMarker.length)
    expect(start, `missing ${startMarker}`).toBeGreaterThan(-1)
    expect(end, `missing ${endMarker} after ${startMarker}`).toBeGreaterThan(start)
    return text.slice(start, end)
}

describe("KRI mining GL posts share the caller transaction", () => {
    it("createBillFromPOId does not nest withPrismaAuth around recordPendingBillFromPO", () => {
        const fn = sliceFn(
            src("lib/actions/finance-invoices.ts"),
            "export async function createBillFromPOId",
            "export async function moveInvoiceToSent",
        )
        expect(fn).not.toMatch(/withPrismaAuth\(async \(prisma\) => \{[\s\S]*recordPendingBillFromPO/)
        expect(fn).toContain("recordPendingBillFromPO(po")
    })

    it("recordPendingBillFromPO bills receivedQty via the pure helper and does not post GL", () => {
        const fn = sliceFn(
            src("lib/actions/finance-invoices.ts"),
            "export async function recordPendingBillFromPO",
            "export async function createInvoiceFromSalesOrder",
        )
        expect(fn).toContain("planBillFromReceived")
        expect(fn).toContain("skipped")
        expect(fn).not.toContain("postJournalEntry")
        expect(fn).not.toContain("po.totalAmount")
        expect(fn).not.toContain("item.quantity")
    })

    it("recordVendorPayment and approveAndPayBill pass tx client into postJournalEntry", () => {
        const ap = src("lib/actions/finance-ap.ts")
        const pay = sliceFn(ap, "export async function recordVendorPayment", "export async function recordMultiBillPayment")
        expect(pay).toContain(", prisma)")
        expect(pay).toContain("postJournalEntry(")

        const multi = sliceFn(ap, "export async function recordMultiBillPayment", "export async function getVendorAPBalances")
        expect(multi).toContain(", prisma)")
        expect(multi).toContain("postJournalEntry(")

        const instantStart = ap.indexOf("export async function approveAndPayBill")
        expect(instantStart).toBeGreaterThan(-1)
        const instant = ap.slice(instantStart)
        const posts = instant.match(/postJournalEntry\(/g) || []
        expect(posts.length).toBeGreaterThanOrEqual(2)
        expect((instant.match(/, prisma\)/g) || []).length).toBeGreaterThanOrEqual(posts.length)
    })

    it("payroll approve and disbursement post 6130/GL inside the same transaction", () => {
        const hcm = src("app/actions/hcm.ts")
        const approve = sliceFn(hcm, "export async function approvePayrollRun", "export async function getDistinctDepartments")
        expect(approve).toContain("postJournalEntry(")
        expect(approve).toContain(", prisma)")
        expect(approve).toContain("employerExpenseCode")

        const disburse = sliceFn(hcm, "export async function createPayrollDisbursementBatch", "export async function generatePayrollDraft")
        expect(disburse).toContain("postJournalEntry(")
        expect(disburse).toContain(", prisma)")
    })
})

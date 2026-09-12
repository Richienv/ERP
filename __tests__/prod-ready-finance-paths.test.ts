/**
 * Production gate: stale money paths must delegate to canonical GL.
 * Logic-only — reads source, no database.
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

describe("stale finance.ts money paths delegate", () => {
    const finance = src("lib/actions/finance.ts")

    it("createInvoiceFromSalesOrder is a thin canonical wrapper", () => {
        const fn = sliceFn(
            finance,
            "export async function createInvoiceFromSalesOrder",
            "export async function getPendingSalesOrders",
        )
        expect(fn).toContain('import("./finance-invoices")')
        expect(fn).not.toContain("withPrismaAuth")
        expect(fn).not.toMatch(/code:\s*'1200'/)
        expect(fn).not.toMatch(/code:\s*'4000'/)
    })

    it("approveAndPayBill is a thin canonical wrapper", () => {
        const fn = sliceFn(
            finance,
            "export async function approveAndPayBill",
            "export async function getFinanceDashboardData",
        )
        expect(fn).toContain('import("./finance-ap")')
        expect(fn).not.toContain("withPrismaAuth")
        expect(fn).not.toContain("console.error(\"GL posting failed\"")
    })
})

describe("Xendit AP payout posts GL on success", () => {
    it("processXenditPayout refuses DRAFT and does not flip status", () => {
        const payout = src("lib/actions/xendit.ts")
        const fn = sliceFn(payout, "export async function processXenditPayout", "export async function getAvailableBanks")
        expect(fn).toContain("Tagihan harus disetujui dulu")
        expect(fn).not.toContain("status: 'ISSUED'")
    })

    it("webhook SUCCEEDED goes through settleSucceededXenditPayout", () => {
        const webhook = src("app/api/xendit/webhook/route.ts")
        expect(webhook).toContain("settleSucceededXenditPayout")
        expect(webhook).not.toMatch(/case 'SUCCEEDED':[\s\S]*status:\s*'PAID'/)
    })

    it("settle posts DR AP / CR Bank inside the caller transaction", () => {
        const ap = src("lib/actions/finance-ap.ts")
        const fn = ap.slice(ap.indexOf("export async function settleSucceededXenditPayout"))
        expect(fn).toContain("postJournalEntry(")
        expect(fn).toContain(", prisma)")
        expect(fn).toContain("SYS_ACCOUNTS.AP")
        expect(fn).toContain("SYS_ACCOUNTS.BANK_BCA")
        expect(fn).toContain("[GL:POSTED]")
        expect(fn).toContain("ensureSystemAccounts")
    })

    it("bills payment dialog no longer exposes the Xendit tab", () => {
        const bills = src("app/finance/bills/page.tsx")
        expect(bills).toContain("handleManualPaySubmit")
        expect(bills).not.toContain("processXenditPayout")
        expect(bills).not.toContain("Xendit")
    })
})

describe("sales leftover paths use TAX_RATES and share the transaction", () => {
    const sales = src("lib/actions/sales.ts")

    it("does not hardcode PPN 0.11 or cash account 1110/1101", () => {
        expect(sales).toContain("TAX_RATES.PPN")
        expect(sales).not.toMatch(/\*\s*0\.11/)
        expect(sales).not.toMatch(/debitAccount = '1110'/)
        expect(sales).not.toMatch(/debitAccount = '1101'/)
        expect(sales).not.toMatch(/accountCode: '4010'/)
    })

    it("approveInvoice, recordPayment, and createSalesReturn pass tx into postJournalEntry", () => {
        const approve = sliceFn(sales, "export async function approveInvoice", "export async function recordPayment")
        expect(approve).toContain(", prisma)")
        expect(approve).toContain("throw new Error(`Jurnal invoice gagal")

        const pay = sliceFn(sales, "export async function recordPayment", "export async function convertQuotationToSalesOrder")
        expect(pay).toContain(", prisma)")
        expect(pay).toContain("getCashAccountCode")

        const retur = sliceFn(sales, "export async function createSalesReturn", "export async function getSalesOrderForReturn")
        expect(retur).toContain(", prisma)")
        expect(retur).toContain("SYS_ACCOUNTS.SALES_RETURNS")
    })

    it("generateInvoiceFromSalesOrder imports the canonical invoice action", () => {
        expect(sales).toContain('from "@/lib/actions/finance-invoices"')
        expect(sales).not.toContain('createInvoiceFromSalesOrder } from "@/lib/actions/finance"')
    })
})

describe("day-1 GRN and depreciation stay inside the caller transaction", () => {
    it("acceptGRN ensures system accounts before inventory GL", () => {
        const grn = src("lib/actions/grn.ts")
        const fn = sliceFn(grn, "export async function acceptGRN", "export async function rejectGRN")
        expect(fn).toContain("ensureSystemAccounts(prisma)")
        expect(fn).toContain("postInventoryGLEntry")
    })

    it("postDepreciationRun passes tx into postJournalEntry", () => {
        const fa = src("lib/actions/finance-fixed-assets.ts")
        const fn = sliceFn(fa, "export async function postDepreciationRun", "export async function getDepreciationRuns")
        expect(fn).toMatch(/postJournalEntry\([\s\S]*, prisma\)/)
    })
})

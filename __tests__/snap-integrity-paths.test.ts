/**
 * Guardrails from the 10-agent snap + integrity audit.
 * Logic-only — reads source, no database.
 */
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { CASH_BANK_CODES, SYS_ACCOUNTS } from "@/lib/gl-accounts"

function src(rel: string) {
    return fs.readFileSync(path.join(process.cwd(), rel), "utf8")
}

describe("Kas KPI includes banks at 111x", () => {
    it("CASH_BANK_CODES covers Kas, Kas Kecil, BCA, Mandiri", () => {
        expect(CASH_BANK_CODES).toEqual([
            SYS_ACCOUNTS.CASH,
            SYS_ACCOUNTS.PETTY_CASH,
            SYS_ACCOUNTS.BANK_BCA,
            SYS_ACCOUNTS.BANK_MANDIRI,
        ])
        expect(SYS_ACCOUNTS.BANK_BCA).toBe("1110")
        expect(SYS_ACCOUNTS.CASH).toBe("1000")
    })

    it("dashboard cash metric no longer cuts off at 1100", () => {
        const finance = src("lib/actions/finance.ts")
        const metrics = finance.slice(
            finance.indexOf("export async function getFinancialMetrics"),
            finance.indexOf("export async function getInvoiceKanbanData"),
        )
        expect(metrics).toContain("CASH_BANK_CODES")
        expect(metrics).not.toMatch(/gte:\s*'1000',\s*lt:\s*'1100'/)
        expect(metrics).toContain("overdueInvoiceCount")
    })

    it("omzet from invoices excludes DRAFT", () => {
        const finance = src("lib/actions/finance.ts")
        const fn = finance.slice(
            finance.indexOf("export async function getRevenueFromInvoices"),
            finance.indexOf("export async function getARAgingReport"),
        )
        expect(fn).toContain("'DRAFT'")
        expect(fn).toMatch(/notIn:\s*\['CANCELLED',\s*'VOID',\s*'DRAFT'\]/)
    })
})

describe("felt-speed connections", () => {
    it("dashboard paints the ops inbox before the executive skeleton", () => {
        const page = src("app/dashboard/dashboard-client.tsx")
        const inboxDecl = page.indexOf("const inbox =")
        const skeleton = page.indexOf('if (!data)')
        expect(inboxDecl).toBeGreaterThan(-1)
        expect(inboxDecl).toBeLessThan(skeleton)
    })

    it("in-page prefetch starts on pointerdown, not only hover", () => {
        const prefetch = src("components/in-page-prefetch.tsx")
        expect(prefetch).toContain('addEventListener("pointerdown"')
    })

    it("stock alert chips bind the active class inside the template", () => {
        const alerts = src("app/inventory/alerts/page.tsx")
        expect(alerts).not.toMatch(/className=\{`[^`]*\$\{statusFilter === s\}\s*\n/)
        expect(alerts).toContain("statusFilter === s")
        expect(alerts).toContain('? "bg-black text-white"')
    })

    it("money-loop pages refresh the CEO inbox after pay / approve / send", () => {
        expect(src("app/finance/invoices/invoices-client.tsx")).toContain("invalidateOpsLoop")
        expect(src("app/finance/bills/page.tsx")).toContain("invalidateOpsLoop")
        expect(src("app/finance/vendor-payments/page.tsx")).toContain("invalidateOpsLoop")
        expect(src("components/procurement/po-details-sheet.tsx")).toContain("invalidateOpsLoop")
        expect(src("components/procurement/inline-approval-list.tsx")).toContain("invalidateOpsLoop")
    })
})

describe("integrity leftovers", () => {
    it("Xendit settle does not require a user session", () => {
        const ap = src("lib/actions/finance-ap.ts")
        const fn = ap.slice(ap.indexOf("export async function settleSucceededXenditPayout"))
        expect(fn).toContain("basePrisma.$transaction")
        expect(fn).not.toContain("withPrismaAuth")
    })

    it("closed fiscal periods block journals even when a txClient is passed", () => {
        const gl = src("lib/actions/finance-gl.ts")
        const fn = gl.slice(
            gl.indexOf("export async function postJournalEntry("),
            gl.indexOf("export async function getJournalEntries"),
        )
        const period = fn.indexOf("await assertPeriodOpen(data.date)")
        const txBranch = fn.indexOf("if (txClient)")
        expect(period).toBeGreaterThan(-1)
        expect(txBranch).toBeGreaterThan(period)
    })

    it("warehouse GRN toast deep-links the draft bill", () => {
        const dialog = src("components/inventory/goods-receipt-dialog.tsx")
        expect(dialog).toContain("/finance/bills?q=")
    })
})

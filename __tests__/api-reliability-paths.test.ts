/**
 * Guardrails for the API reliability kernel.
 * Logic-only — reads source, no database.
 */
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { CASH_BANK_CODES } from "@/lib/gl-accounts"

function src(rel: string) {
    return fs.readFileSync(path.join(process.cwd(), rel), "utf8")
}

describe("HTTP kernel", () => {
    it("exposes jsonOk / jsonFail / handleReadApi / apiFetch / apiMutate", () => {
        expect(src("lib/http/api-response.ts")).toContain("export function jsonOk")
        expect(src("lib/http/api-response.ts")).toContain("export function jsonFail")
        expect(src("lib/http/handle-read-api.ts")).toContain("requireApiUser")
        expect(src("lib/http/handle-read-api.ts")).toContain("jsonFail(401")
        expect(src("lib/http/api-fetch.ts")).toContain("export async function apiFetch")
        expect(src("lib/http/api-fetch.ts")).toContain("export async function apiMutate")
        expect(src("lib/http/api-fetch.ts")).toContain("throw new ApiHttpError")
        expect(src("lib/http/api-fetch.ts")).not.toContain("/login")
    })

    it("retries GET on gateway errors and never retries writes", () => {
        const fetchSrc = src("lib/http/api-fetch.ts")
        const mutate = fetchSrc.slice(fetchSrc.indexOf("export async function apiMutate"))
        expect(fetchSrc).toContain("res.status === 502")
        expect(mutate).not.toContain("continue")
    })
})

describe("thin dashboard and mining pulse", () => {
    it("CEO dashboard loads five thin BFFs independently, not one Promise.all", () => {
        const hook = src("hooks/use-executive-dashboard.ts")
        expect(hook).toContain('apiFetch("/api/dashboard/financials")')
        expect(hook).toContain('apiFetch("/api/dashboard/operations")')
        expect(hook).toContain('apiFetch("/api/dashboard/activity")')
        expect(hook).toContain('apiFetch("/api/dashboard/charts")')
        expect(hook).toContain('apiFetch("/api/dashboard/details")')
        expect(hook).toContain("queryKeys.executiveDashboard.financials()")
        expect(hook).not.toContain("Promise.all")
        expect(hook).not.toContain('apiFetch("/api/dashboard")')
        expect(hook).not.toMatch(/fetch\("\/api\/dashboard"\)/)
    })

    it("pulse and thin dashboard routes use the read kernel", () => {
        for (const file of [
            "app/api/mining/pulse/route.ts",
            "app/api/dashboard/financials/route.ts",
            "app/api/dashboard/operations/route.ts",
            "app/api/dashboard/activity/route.ts",
            "app/api/dashboard/charts/route.ts",
            "app/api/finance/lists/invoices/route.ts",
            "app/api/finance/lists/bills/route.ts",
            "app/api/finance/lists/journal/route.ts",
            "app/api/finance/lists/dashboard/route.ts",
            "app/api/finance/lists/vendor-payments/route.ts",
        ]) {
            const route = src(file)
            expect(route, file).toContain("handleReadApi")
            expect(route, file).not.toContain("FALLBACK_")
        }
    })

    it("inbox client reads pulse over HTTP", () => {
        const pulse = src("components/mining/command-pulse.tsx")
        expect(pulse).toContain('apiFetch<MiningCommandPulse>("/api/mining/pulse")')
        expect(pulse).not.toContain("getMiningCommandPulse()")
    })

    it("legacy mega dashboard authenticates and fails instead of painting zeros", () => {
        const mega = src("app/api/dashboard/route.ts")
        expect(mega).toContain("requireApiUser")
        expect(mega).toContain('jsonFail(401')
        expect(mega).toContain('jsonFail(500')
        expect(mega).not.toContain("return FALLBACK_FINANCIALS")
        expect(mega).toContain("reject(new Error")
    })
})

describe("hot list APIs replace client server-actions", () => {
    it("finance hooks fetch list APIs", () => {
        expect(src("hooks/use-invoices.ts")).toContain("/api/finance/lists/invoices")
        expect(src("hooks/use-bills.ts")).toContain("/api/finance/lists/bills")
        expect(src("hooks/use-journal.ts")).toContain("/api/finance/lists/journal")
        expect(src("hooks/use-finance-dashboard.ts")).toContain("/api/finance/lists/dashboard")
        expect(src("hooks/use-vendor-payments.ts")).toContain("/api/finance/lists/vendor-payments")
        expect(src("hooks/use-invoices.ts")).not.toContain("getInvoiceKanbanData(")
        expect(src("hooks/use-bills.ts")).not.toContain("getVendorBillsRegistry(")
    })

    it("sidebar and inventory/procurement dashboards throw on !ok", () => {
        expect(src("hooks/use-sidebar-actions.ts")).toContain('apiFetch<SidebarActionCounts>("/api/sidebar/action-counts")')
        expect(src("hooks/use-inventory-dashboard.ts")).toContain('"/api/inventory/dashboard"')
        expect(src("hooks/use-inventory-dashboard.ts")).toContain("apiFetch")
        expect(src("hooks/use-procurement-dashboard.ts")).toContain("apiFetch(url)")
        expect(src("app/api/sidebar/action-counts/route.ts")).toContain("jsonFail(500")
        expect(src("app/api/sidebar/action-counts/route.ts")).not.toContain("vendorsIncomplete: 0")
        expect(src("app/api/inventory/dashboard/route.ts")).toContain("jsonFail(500")
        expect(src("app/api/procurement/dashboard/route.ts")).toContain("jsonFail(500")
    })
})

describe("stock health and Kas correctness", () => {
    it("sidebar low-stock uses SQL aggregate, not product.findMany", () => {
        const sidebar = src("app/api/sidebar/action-counts/route.ts")
        expect(sidebar).toContain("queryStockHealth")
        expect(sidebar).not.toContain("product.findMany")
    })

    it("stock SQL groups by product before comparing minStock", () => {
        const sql = src("lib/stock-aggregates.ts")
        expect(sql).toContain("GROUP BY p.id")
        expect(sql).toContain("byProduct")
        expect(sql).toContain("queryRaw")
    })

    it("finance dashboard-data uses CASH_BANK_CODES and POSTED journals", () => {
        const route = src("app/api/finance/dashboard-data/route.ts")
        expect(route).toContain("CASH_BANK_CODES")
        expect(route).toContain('status: "POSTED"')
        expect(CASH_BANK_CODES).toContain("1110")
        expect(route).not.toContain('code.startsWith("10")')
    })
})

describe("hot query indexes", () => {
    it("adds composite indexes for invoice aging, posted journals, and leave inbox", () => {
        const schema = src("prisma/schema.prisma")
        expect(schema).toContain("@@index([type, status, dueDate])")
        expect(schema).toContain("@@index([status, date])")
        expect(schema).toContain("@@index([status])")
        const migration = src("prisma/migrations/20260913000000_hot_api_indexes/migration.sql")
        expect(migration).toContain("invoices_type_status_dueDate_idx")
        expect(migration).toContain("journal_entries_status_date_idx")
        expect(migration).toContain("leave_requests_status_idx")
        expect(migration).toContain("leave_requests_employeeId_idx")
        expect(migration).toContain("payments_date_idx")
        expect(src("prisma/schema.prisma")).toContain("@@index([date])")
    })
})

describe("write-path leftovers from the reliability audit", () => {
    it("Xendit SUCCEEDED without a Payment returns 500 so Xendit retries", () => {
        const webhook = src("app/api/xendit/webhook/route.ts")
        expect(webhook).toContain("Payment not found for SUCCEEDED payout")
        expect(webhook).toContain("{ number: reference_id }")
        const missing = webhook.slice(webhook.indexOf("Payment not found for reference"))
        expect(missing).toContain('status === \'SUCCEEDED\'')
        expect(missing).toContain("status: 500")
    })

    it("opening-balance POST refuses a second journal instead of delete-and-increment", () => {
        const route = src("app/api/finance/opening-balances/route.ts")
        const post = route.slice(route.indexOf("export async function POST"))
        expect(post).toContain("status: 409")
        expect(post).toContain("OPENING-BALANCE-${year}")
        expect(post).not.toContain("journalEntry.delete")
    })

    it("three-way inbox count uses SQL and keeps the JS fallback", () => {
        const match = src("lib/actions/finance-match.ts")
        expect(match).toContain("$queryRaw")
        expect(match).toContain("OVER_BILLED")
        expect(match).toContain("falling back")
        expect(match).toContain("fromLoadedBill")
        expect(match).toContain("countOverBilledDraftsFromLoaded")
    })
})

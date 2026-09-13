/**
 * Second-round API speed + correctness leftovers (after the HTTP kernel).
 * Logic-only — reads source, no database.
 */
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { CASH_BANK_CODES, isCashBankCode } from "@/lib/gl-accounts"

function src(rel: string) {
    return fs.readFileSync(path.join(process.cwd(), rel), "utf8")
}

function sliceFn(text: string, startMarker: string, endMarker?: string) {
    const start = text.indexOf(startMarker)
    expect(start, `missing ${startMarker}`).toBeGreaterThan(-1)
    const end = endMarker ? text.indexOf(endMarker, start + startMarker.length) : text.length
    return text.slice(start, end > start ? end : undefined)
}

describe("Kas HTTP copies use CASH_BANK_CODES + POSTED", () => {
    it("keeps BCA/Mandiri in the canonical Kas set", () => {
        expect(CASH_BANK_CODES).toEqual(["1000", "1050", "1110", "1111"])
        expect(isCashBankCode("1110")).toBe(true)
        expect(isCashBankCode("1200")).toBe(false)
    })

    it("metrics uses CASH_BANK_CODES and posted expense aggregates", () => {
        const route = src("app/api/finance/metrics/route.ts")
        expect(route).toContain("CASH_BANK_CODES")
        expect(route).toContain('status: "POSTED"')
        expect(route).toContain("journalLine.aggregate")
        expect(route).not.toContain('lt: "1100"')
        expect(route).not.toContain("recentExpenseLines")
    })

    it("reports cash-flow and expenses-data do not cut banks at 1100", () => {
        const reports = src("app/api/finance/reports/route.ts")
        const cash = sliceFn(reports, "async function fetchCashFlow", "async function fetch")
        expect(cash).toContain("CASH_BANK_CODES")
        expect(cash).not.toContain("lt: '1100'")
        expect(src("app/api/finance/expenses-data/route.ts")).toContain("CASH_BANK_CODES")
        expect(src("app/api/finance/expenses-data/route.ts")).not.toContain("1010")
        expect(src("components/finance/cashflow-planning-board.tsx")).toContain("isCashBankCode")
        expect(src("components/finance/cashflow-planning-board.tsx")).not.toContain('startsWith("10")')
    })

    it("canonical cash-flow statement and burn use posted aggregates", () => {
        const finance = src("lib/actions/finance.ts")
        const cf = sliceFn(finance, "export async function getCashFlowStatement", "export async function getPendingSalesOrders")
        expect(cf).toContain("CASH_BANK_CODES")
        expect(cf).toContain("journalLine.aggregate")
        expect(cf).not.toContain("lt: '1100'")
        const metrics = sliceFn(finance, "export async function getFinancialMetrics", "export async function getInvoiceKanbanData")
        expect(metrics).toContain('status: "POSTED"')
        expect(metrics).toContain("journalLine.aggregate")
    })
})

describe("dashboard action layer fails closed on money", () => {
    it("financials / operations / charts rethrow instead of painting zeros", () => {
        const dash = src("app/actions/dashboard.ts")
        const financials = sliceFn(dash, "export async function getDashboardFinancials", "export async function getDashboardOperations")
        expect(financials).toContain("throw error")
        expect(financials).not.toContain("cashBalance: 0")
        const operations = sliceFn(dash, "export async function getDashboardOperations", "export async function getDashboardActivity")
        expect(operations).toContain("fetchCashFlowSummary(prisma)")
        expect(operations).not.toContain("kasMasuk: 0")
        expect(operations).toContain("throw error")
        const charts = sliceFn(dash, "export async function getDashboardCharts", "export async function getLatestSnapshot")
        expect(charts).toContain("throw error")
        expect(charts).not.toContain("dataCash7d: []")
    })

    it("week cash and chart cash use CASH_BANK_CODES not 1xxx", () => {
        const dash = src("app/actions/dashboard.ts")
        const cash = sliceFn(dash, "async function fetchCashFlowSummary", "async function fetchProfitability")
        expect(cash).toContain("CASH_BANK_CODES")
        expect(cash).toContain("journalLine.aggregate")
        expect(cash).not.toContain("startsWith: '1'")
        const charts = sliceFn(dash, "async function fetchFinancialChartData", "async function fetchDeadStockValue")
        expect(charts).toContain("CASH_BANK_CODES")
        expect(charts).not.toContain("startsWith: '1'")
    })
})

describe("procurement stats and inventory KPI split", () => {
    it("procurement spend aggregates and urgent-needs uses mapped tables", () => {
        const proc = src("lib/actions/procurement.ts")
        const stats = sliceFn(proc, "export async function getProcurementStats", "export async function getPurchaseRequests")
        expect(stats).toContain("await getAuthzUser()")
        expect(stats.indexOf("await getAuthzUser()")).toBeLessThan(stats.indexOf("try {"))
        expect(stats).toContain("purchaseOrder.aggregate")
        expect(stats).toContain("queryStockHealth")
        expect(stats).toContain("throw error")
        expect(stats).not.toContain('public."Product"')
        expect(stats).not.toContain('public."StockLevel"')
        expect(stats).not.toContain("spend: { current: 0, growth: 0 }")
    })

    it("inventory KPIs and stats API use SQL instead of product.findMany", () => {
        const kpis = sliceFn(src("app/actions/inventory.ts"), "export async function getInventoryKPIs", "export async function getMaterialGapAnalysis")
        expect(kpis).toContain("queryInventoryDashboardKpis")
        expect(kpis).not.toContain("product.findMany")
        expect(src("lib/stock-aggregates.ts")).toContain("queryInventoryDashboardKpis")
        expect(src("lib/stock-aggregates.ts")).toContain("queryWarehouseInventory")
        const stats = src("app/api/inventory/stats/route.ts")
        expect(stats).toContain("handleReadApi")
        expect(stats).toContain("queryInventoryDashboardKpis")
        expect(src("hooks/use-inventory-dashboard.ts")).toContain("/api/inventory/stats")
        expect(src("hooks/use-inventory-dashboard.ts")).not.toContain("Promise.all")
    })
})

describe("query retry and KRI prefetch leftovers", () => {
    it("does not retry 401/403/404", () => {
        const qc = src("lib/query-client.tsx")
        expect(qc).toContain("status === 401 || status === 403 || status === 404")
        expect(qc).not.toMatch(/queries:\s*\{[^}]*retry:\s*1/)
    })

    it("KRI cashflow and opening-stock prefetch throw on !ok", () => {
        const prefetch = src("hooks/use-nav-prefetch.ts")
        expect(prefetch).toContain('apiFetch("/api/finance/cashflow-forecast?months=6")')
        expect(prefetch).toContain("apiFetch(\"/api/inventory/stats\")")
        expect(prefetch).not.toContain('fetch("/api/finance/cashflow-forecast')
        expect(prefetch).not.toContain('fetch("/api/inventory/opening-stock")')
        expect(src("hooks/use-cashflow-forecast.ts")).toContain("apiFetch")
        expect(src("hooks/use-cashflow-plan.ts")).toContain("apiFetch")
        expect(src("hooks/use-finance-reports.ts")).toContain("apiFetch")
        expect(src("app/inventory/products/page.tsx")).not.toContain("return FALLBACK")
        expect(prefetch).toContain('apiFetch<{ data?: { banks?: unknown[]; ewallets?: unknown[] } }>("/api/xendit/banks")')
        expect(prefetch).not.toContain('fetch("/api/xendit/banks")')
    })
})

describe("Xendit settle claims the payment row first", () => {
    it("CAS-updates notes to POSTING before postJournalEntry", () => {
        const ap = src("lib/actions/finance-ap.ts")
        const fn = ap.slice(ap.indexOf("export async function settleSucceededXenditPayout"))
        expect(fn).toContain("updateMany")
        expect(fn).toContain("[GL:POSTING]")
        expect(fn.indexOf("updateMany")).toBeLessThan(fn.indexOf("postJournalEntry"))
        expect(fn).toContain("[GL:POSTED]")
        expect(fn).toContain("findUnique")
        expect(fn).toContain("number: params.referenceId")
        expect(fn).not.toContain("where: { reference: params.referenceId }")
    })
})

describe("round-2 leftover Kas, write, and ops-lane guards", () => {
    it("cashflow plan/actual use CASH_BANK_CODES not 10xx/11xx prefixes", () => {
        const cf = src("lib/actions/finance-cashflow.ts")
        const start = sliceFn(cf, "async function getStartingBalance", "async function getARItems")
        expect(start).toContain("CASH_BANK_CODES")
        expect(start).not.toContain('startsWith: "10"')
        const actual = sliceFn(cf, "async function getActualTransactions", "async function getSOItems")
        expect(actual).toContain("CASH_BANK_CODES")
        const live = sliceFn(cf, "export async function getCashflowActualData", undefined)
        expect(live).toContain("CASH_BANK_CODES")
        expect(live).not.toContain('startsWith: "10"')
        expect(live).not.toContain('startsWith: "11"')
    })

    it("bank pickers keep 111x and do not regex-filter 10xx", () => {
        expect(src("app/api/master/bank-accounts/route.ts")).toContain("CASH_BANK_CODES")
        expect(src("app/api/master/bank-accounts/route.ts")).not.toContain("/^10")
        expect(src("hooks/use-bank-accounts.ts")).not.toContain("/^10")
        const petty = src("lib/actions/finance-petty-cash.ts")
        const banks = sliceFn(petty, "export async function getBankAccounts", "export async function createBankAccount")
        expect(banks).toContain("CASH_BANK_CODES")
        expect(banks).not.toContain('lt: "1200"')
        const create = sliceFn(petty, "export async function createBankAccount")
        expect(create).toContain('startsWith: "111"')
        expect(create).toContain('"1112"')
        expect(create).not.toContain('"1010"')
        expect(src("app/finance/bills/page.tsx")).toContain("SYS_ACCOUNTS.BANK_BCA")
        expect(src("app/finance/bills/page.tsx")).not.toContain('"1010"')
    })

    it("webhook looks up payment by unique number and does not un-pay posted GL", () => {
        const webhook = src("app/api/xendit/webhook/route.ts")
        expect(webhook).toContain("findUnique")
        expect(webhook).toContain("where: { number: reference_id }")
        expect(webhook).not.toContain("{ reference: reference_id }")
        expect(webhook).toContain("[GL:POSTED]")
        expect(webhook).toContain("alreadyPosted")
        const failed = webhook.slice(webhook.indexOf("case 'FAILED'"))
        expect(failed).toContain("!alreadyPosted")
        expect(failed.indexOf("alreadyPosted")).toBeLessThan(failed.indexOf("status: 'ISSUED'"))
    })

    it("ops lane fails closed on money/compliance and counts partial receipts in spend", () => {
        const dash = src("app/actions/dashboard.ts")
        const operations = sliceFn(dash, "export async function getDashboardOperations", "export async function getDashboardActivity")
        expect(operations).toContain("fetchProcurementMetrics(prisma)")
        expect(operations).toContain("fetchHRMetrics(prisma)")
        expect(operations).toContain("fetchTaxMetrics(prisma)")
        expect(operations).toContain("fetchInventorySummary(prisma)")
        expect(operations).toContain("fetchComplianceStatus(prisma)")
        expect(operations).not.toContain("fetchProcurementMetrics(prisma).catch")
        expect(operations).not.toContain("fetchHRMetrics(prisma).catch")
        expect(operations).not.toContain("fetchTaxMetrics(prisma).catch")
        expect(operations).not.toContain("fetchInventorySummary(prisma).catch")
        expect(operations).not.toContain("fetchComplianceStatus(prisma).catch")
        expect(operations).not.toContain("status: 'green'")
        const stats = sliceFn(src("lib/actions/procurement.ts"), "export async function getProcurementStats", "export async function getPurchaseRequests")
        expect(stats).toContain("'PARTIAL_RECEIVED'")
        expect(stats).toMatch(/activeSpendStatuses[\s\S]*PARTIAL_RECEIVED/)
    })

    it("posted-only burn, COA tree, expenses, unreconciled Kas, and no fake year-close", () => {
        const reports = src("lib/actions/finance-reports.ts")
        expect(reports).toContain(".eq('journal_entries.status', 'POSTED')")
        const unrec = sliceFn(reports, "export async function getUnreconciledBankEntryCount")
        expect(unrec).toContain("CASH_BANK_CODES")
        expect(unrec).not.toContain("startsWith: '111'")
        expect(src("app/api/finance/chart-accounts-tree/route.ts")).toContain('status: "POSTED"')
        expect(src("app/api/finance/expenses-data/route.ts")).toContain('status: "POSTED"')
        const fiscal = src("app/api/finance/fiscal-periods/route.ts")
        expect(fiscal).toContain("status: 501")
        expect(fiscal).toContain("Tutup tahun belum diimplementasi")
        expect(fiscal).not.toContain("{ success: true, year }")
    })
})

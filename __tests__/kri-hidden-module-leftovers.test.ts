/**
 * Hidden modules (sales pipeline, POS, manufacturing) must not keep costing the
 * mining edition: no queries, no prefetch, no palette entries, no dead links.
 * Logic-only — reads source, no database / HTTP server.
 */
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { isKriHiddenApiPath, isKriHiddenPath } from "@/lib/kri-module-gates"
import { MODULE_FLAGS } from "@/lib/sidebar-feature-flags"
import { CMDK_ACTIONS, VISIBLE_CMDK_ACTIONS, VISIBLE_PINNED_ACTIONS } from "@/lib/cmdk-registry"

function src(rel: string) {
    return fs.readFileSync(path.join(process.cwd(), rel), "utf8")
}

/** Slice a source file between two markers so assertions stay local. */
function sliceBetween(source: string, start: string, end: string) {
    const from = source.indexOf(start)
    expect(from, `missing marker: ${start}`).toBeGreaterThan(-1)
    const to = source.indexOf(end, from)
    return source.slice(from, to > from ? to : undefined)
}

describe("hidden-module API gate", () => {
    it("blocks module-owned sales and manufacturing APIs", () => {
        expect(isKriHiddenApiPath("/api/sales/page-data")).toBe(true)
        expect(isKriHiddenApiPath("/api/sales/options")).toBe(true)
        expect(isKriHiddenApiPath("/api/sales/orders/abc")).toBe(true)
        expect(isKriHiddenApiPath("/api/manufacturing/work-orders")).toBe(true)
        expect(isKriHiddenApiPath("/api/costing/dashboard-data")).toBe(true)
    })

    it("keeps APIs that visible modules still depend on", () => {
        // Only customer read API — Finance invoicing and global search use it.
        expect(isKriHiddenApiPath("/api/sales/customers")).toBe(false)
        // PDF rendering for PO, GRN and payroll lives under /api/documents.
        expect(isKriHiddenApiPath("/api/documents/purchase-order/1")).toBe(false)
        expect(isKriHiddenApiPath("/api/finance/invoices/available-orders")).toBe(false)
        expect(isKriHiddenApiPath("/api/inventory/page-data")).toBe(false)
    })

    it("is wired into middleware behind the ENABLED_MODULES check", () => {
        const middleware = src("middleware.ts")
        expect(middleware).toContain("isKriHiddenApiPath")
        const apiBlock = sliceBetween(
            middleware,
            "if (isApiRoute)",
            "// Check if it's a protected route",
        )
        expect(apiBlock).toContain("!getEnabledModules() && isKriHiddenApiPath(pathname)")
        expect(apiBlock).toContain("status: 404")
    })
})

describe("dashboard skips hidden-module queries", () => {
    it("only counts sales orders when the sales pipeline is visible", () => {
        const sales = src("lib/actions/sales.ts")
        const stats = sliceBetween(
            sales,
            "export async function getSalesStats",
            "export async function getAllCustomers",
        )
        expect(stats).toContain('isModuleEnabled("sales")')
        // Revenue is invoice-based and must survive — KRI bills from Finance.
        expect(stats).toContain("basePrisma.invoice.aggregate")
        for (const guarded of ["salesOrder.count", "salesOrder.findMany"]) {
            expect(stats).toContain(guarded)
            expect(stats.indexOf("salesPipelineVisible")).toBeLessThan(stats.indexOf(guarded))
        }
    })

    it("skips work-order, QC and fulfillment fetchers for hidden modules", () => {
        const dashboard = src("app/actions/dashboard.ts")
        const ops = sliceBetween(
            dashboard,
            "export async function getDashboardOperations",
            "/** Group C:",
        )
        expect(ops).toContain('isModuleEnabled("manufacturing")')
        expect(ops).toContain('isModuleEnabled("sales")')
        expect(ops).toContain("manufacturingVisible\n                ? fetchProductionMetrics")
        expect(ops).toContain("manufacturingVisible\n                ? fetchQualityStatus")
        expect(ops).toContain("salesVisible\n                ? fetchSalesFulfillment")
        expect(ops).toContain("salesVisible\n                ? fetchProfitability")
        expect(ops).toContain("salesVisible\n                ? fetchCustomerInsights")
    })

    it("does not read work-order previews for a hidden manufacturing card", () => {
        const route = src("app/api/dashboard/route.ts")
        const details = sliceBetween(route, "async function fetchCardDetails", "export async function GET")
        expect(details).toContain('isModuleEnabled("manufacturing")')
        expect(details.indexOf('isModuleEnabled("manufacturing")')).toBeLessThan(
            details.indexOf("prisma.workOrder.findMany"),
        )
    })
})

describe("prefetch does not warm hidden modules", () => {
    it("bails out of hover prefetch for hidden routes", () => {
        const prefetch = src("hooks/use-nav-prefetch.ts")
        expect(prefetch).toContain("if (isKriHiddenPath(url)) return")
        const body = sliceBetween(prefetch, "const prefetchRoute = useCallback", "return { prefetchRoute }")
        expect(body.indexOf("isKriHiddenPath(url)")).toBeLessThan(body.indexOf("router.prefetch(url)"))
    })

    it("keeps /api/sales/options out of the login-time master warm", () => {
        const refresh = src("hooks/use-background-refresh.ts")
        expect(refresh).toContain("isHiddenMasterDataKey(key)")
        expect(refresh).toContain("isKriHiddenPath(route.split(\"#\")[0])")
    })
})

describe("invoice creation no longer depends on sales orders", () => {
    const dialog = src("components/finance/create-invoice-dialog.tsx")

    it("drops the unreachable Sales Order source from the dialog", () => {
        expect(dialog).not.toContain("createInvoiceFromSalesOrder")
        expect(dialog).not.toContain("'SO'")
        expect(dialog).toContain("useState<'PO' | 'MANUAL'>('MANUAL')")
    })

    it("stops reading pending sales orders in the dialog payload API", () => {
        const route = src("app/api/finance/invoices/available-orders/route.ts")
        expect(route).toContain('isModuleEnabled("sales")')
        expect(route.indexOf('isModuleEnabled("sales")')).toBeLessThan(
            route.indexOf("prisma.salesOrder.findMany"),
        )
    })

    it("keeps the canonical server action available for tenants with sales on", () => {
        expect(src("lib/actions/finance-invoices.ts")).toContain(
            "export async function createInvoiceFromSalesOrder",
        )
    })
})

describe("command palette hides modules the user cannot open", () => {
    it("drops sales, POS and manufacturing entries while those flags are off", () => {
        expect(MODULE_FLAGS.sales).toBe(false)
        expect(MODULE_FLAGS.pos).toBe(false)
        expect(MODULE_FLAGS.manufacturing).toBe(false)
        expect(VISIBLE_CMDK_ACTIONS.length).toBeLessThan(CMDK_ACTIONS.length)
        for (const action of VISIBLE_CMDK_ACTIONS) {
            expect(isKriHiddenPath(action.route), `${action.id} → ${action.route}`).toBe(false)
        }
        const ids = VISIBLE_CMDK_ACTIONS.map((a) => a.id)
        expect(ids).not.toContain("nav-pos")
        expect(ids).not.toContain("nav-sales-quotations")
        expect(ids).not.toContain("nav-mfg-bom")
    })

    it("keeps pinned quick actions on routes that actually open", () => {
        expect(VISIBLE_PINNED_ACTIONS.length).toBeGreaterThan(0)
        for (const action of VISIBLE_PINNED_ACTIONS) {
            expect(isKriHiddenPath(action.route)).toBe(false)
        }
        expect(VISIBLE_PINNED_ACTIONS.map((a) => a.id)).toContain("act-create-invoice")
    })

    it("renders the filtered registry, not the raw one", () => {
        const palette = src("components/command-palette.tsx")
        expect(palette).toContain("VISIBLE_CMDK_ACTIONS")
        expect(palette).toContain("VISIBLE_PINNED_ACTIONS")
        expect(palette).toContain("createCmdKFilter(VISIBLE_CMDK_BY_ID)")
    })
})

describe("global search links somewhere reachable", () => {
    it("routes customer hits to Finance invoices while sales is hidden", () => {
        const page = src("app/search/page.tsx")
        expect(page).toContain('isModuleEnabled("sales")')
        expect(page).toContain("/finance/invoices?q=")
    })
})

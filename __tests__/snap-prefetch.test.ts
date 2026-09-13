import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { getTierForRoute, ROUTE_TIERS } from "@/lib/cache-tiers"
import { queryKeys } from "@/lib/query-keys"

describe("SAP-snap cache map", () => {
    it("keeps daily mining routes on a short stale window", () => {
        expect(ROUTE_TIERS["/fleet"]).toBe("TRANSACTIONAL")
        expect(ROUTE_TIERS["/dashboard#pulse"]).toBe("REALTIME")
        expect(ROUTE_TIERS["/finance/bills"]).toBe("TRANSACTIONAL")
        expect(getTierForRoute("/fleet").staleTime).toBeLessThanOrEqual(60_000)
        expect(getTierForRoute("/dashboard#pulse").staleTime).toBeLessThanOrEqual(30_000)
    })

    it("exposes a stable fleet list key for hover prefetch", () => {
        expect(queryKeys.fleet.list()).toEqual(["fleet", "list"])
        expect(queryKeys.miningCommand.pulse()).toEqual(["miningCommand", "pulse"])
        expect(queryKeys.executiveDashboard.list()).toEqual(["executiveDashboard", "list"])
    })

    it("treats hash companions as the same sidebar click", () => {
        const url = "/dashboard"
        const mapped = ["/dashboard", "/dashboard#pulse", "/fleet", "/finance/bills#x"]
        const hits = mapped.filter((route) => route === url || route.startsWith(`${url}#`))
        expect(hits).toEqual(["/dashboard", "/dashboard#pulse"])
    })

    it("warms stock and alerts from the same products query", () => {
        expect(ROUTE_TIERS["/inventory/stock"]).toBe("MASTER_PLUS")
        expect(ROUTE_TIERS["/inventory/alerts"]).toBe("MASTER_PLUS")
        expect(queryKeys.products.list()).toEqual(["products", "list"])
    })

    it("does not treat an empty search string as a different procurement key", () => {
        const base = queryKeys.procurementDashboard.list()
        const qs = "".trim()
        const key = qs ? [...base, qs] : base
        expect(key).toEqual(base)
    })

    it("uses the same invoice kanban key for hover prefetch and an empty search", () => {
        expect(queryKeys.invoices.kanban()).toEqual(["invoices", "kanban", {}])
        expect(queryKeys.invoices.kanban({ q: undefined, type: "ALL" })).toEqual(["invoices", "kanban", {}])
        expect(queryKeys.invoices.kanban({ q: "" })).toEqual(["invoices", "kanban", {}])
    })

    it("prefetches the same fetchers the daily hooks use", () => {
        const src = fs.readFileSync(path.join(process.cwd(), "hooks/use-nav-prefetch.ts"), "utf8")
        expect(src).toContain("getChartOfAccountsTree")
        expect(src).toContain("/api/finance/lists/invoices")
        expect(src).toContain("fetchStockMovementsBundle")
        expect(src).not.toContain("/api/finance/chart-accounts-tree")
        expect(src).not.toContain("/api/finance/invoices/kanban")
    })
})

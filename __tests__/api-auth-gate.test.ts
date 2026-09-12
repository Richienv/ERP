/**
 * Production gate: unauthenticated business APIs must be locked.
 * Logic-only — reads source, no database / HTTP server.
 */
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { isPublicApiPath, PUBLIC_API_PATHS } from "@/lib/api-public-paths"
import { isKriHiddenPath } from "@/lib/kri-module-gates"

function src(rel: string) {
    return fs.readFileSync(path.join(process.cwd(), rel), "utf8")
}

describe("API public-path allowlist", () => {
    it("allows only health, tenant, Xendit webhook, and local demo", () => {
        expect(PUBLIC_API_PATHS).toEqual([
            "/api/health",
            "/api/tenant",
            "/api/xendit/webhook",
            "/api/dev/local-demo",
        ])
        expect(isPublicApiPath("/api/health")).toBe(true)
        expect(isPublicApiPath("/api/xendit/webhook")).toBe(true)
        expect(isPublicApiPath("/api/dashboard/pending-invoices")).toBe(false)
        expect(isPublicApiPath("/api/manufacturing/work-orders")).toBe(false)
        expect(isPublicApiPath("/api/finance/dashboard-data")).toBe(false)
        expect(isPublicApiPath("/api/hcm/payroll-data")).toBe(false)
    })
})

describe("middleware locks /api", () => {
    const middleware = src("middleware.ts")

    it("includes /api in the matcher and returns 401 JSON without clearing cookies", () => {
        expect(middleware).toContain("isPublicApiPath")
        expect(middleware).toContain('pathname.startsWith("/api/")')
        expect(middleware).toContain('status: 401')
        expect(middleware).not.toContain("(?!api/")
        expect(middleware).toContain("Never clear auth cookies on API 401")
        const apiBlockStart = middleware.indexOf("if (isApiRoute)")
        const apiBlockEnd = middleware.indexOf("// Check if it's a protected route")
        expect(apiBlockStart).toBeGreaterThan(-1)
        expect(apiBlockEnd).toBeGreaterThan(apiBlockStart)
        expect(middleware.slice(apiBlockStart, apiBlockEnd)).not.toContain("clearAuthCookies")
    })

    it("hides KRI-off modules when ENABLED_MODULES is unset", () => {
        expect(middleware).toContain("isKriHiddenPath")
        expect(isKriHiddenPath("/sales/orders")).toBe(true)
        expect(isKriHiddenPath("/manufacturing/bom")).toBe(true)
        expect(isKriHiddenPath("/dashboard/pos")).toBe(true)
        expect(isKriHiddenPath("/finance/bills")).toBe(false)
        expect(isKriHiddenPath("/procurement")).toBe(false)
        expect(isKriHiddenPath("/fleet")).toBe(false)
        expect(isKriHiddenPath("/inventory/alerts")).toBe(false)
    })
})

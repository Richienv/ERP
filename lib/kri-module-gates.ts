import { MODULE_FLAGS, type ModuleKey } from "@/lib/sidebar-feature-flags"

/**
 * Page prefixes that follow KRI sidebar flags when ENABLED_MODULES is unset.
 * Hidden modules stay in the repo for reuse, but production traffic is
 * redirected to /dashboard instead of being URL-reachable.
 */
const PATH_MODULE_KEYS: { prefix: string; key: ModuleKey }[] = [
    { prefix: "/sales", key: "sales" },
    { prefix: "/dashboard/pos", key: "pos" },
    { prefix: "/dashboard/ecommerce", key: "sales" },
    { prefix: "/manufacturing", key: "manufacturing" },
    { prefix: "/cutting", key: "manufacturing" },
    { prefix: "/subcontract", key: "manufacturing" },
    { prefix: "/costing", key: "manufacturing" },
    { prefix: "/documents", key: "documents" },
    { prefix: "/accountant", key: "accountantPortal" },
    { prefix: "/manager", key: "managerPortal" },
    { prefix: "/staff", key: "staffPortal" },
]

/**
 * API prefixes owned exclusively by hidden modules. Shared endpoints are
 * deliberately absent:
 *  - `/api/sales/customers` is the only customer read API and Finance/global
 *    search still need it.
 *  - `/api/documents/*` renders PO, GRN and payroll PDFs for visible modules,
 *    even though the Documents *pages* are hidden.
 */
const API_MODULE_KEYS: { prefix: string; key: ModuleKey }[] = [
    { prefix: "/api/sales/page-data", key: "sales" },
    { prefix: "/api/sales/dashboard", key: "sales" },
    { prefix: "/api/sales/options", key: "sales" },
    { prefix: "/api/sales/orders", key: "sales" },
    { prefix: "/api/sales/quotations", key: "sales" },
    { prefix: "/api/sales/quotations-data", key: "sales" },
    { prefix: "/api/sales/leads", key: "sales" },
    { prefix: "/api/sales/discounts", key: "sales" },
    { prefix: "/api/sales/pricelists-data", key: "sales" },
    { prefix: "/api/sales/salespersons", key: "sales" },
    { prefix: "/api/manufacturing", key: "manufacturing" },
    { prefix: "/api/cutting", key: "manufacturing" },
    { prefix: "/api/subcontract", key: "manufacturing" },
    { prefix: "/api/costing", key: "manufacturing" },
]

function matchesHiddenModule(
    pathname: string,
    entries: { prefix: string; key: ModuleKey }[],
): boolean {
    const match = entries.find(
        (entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`),
    )
    if (!match) return false
    return MODULE_FLAGS[match.key] === false
}

export function isKriHiddenPath(pathname: string): boolean {
    return matchesHiddenModule(pathname, PATH_MODULE_KEYS)
}

/**
 * True when an API route belongs to a module that is hidden. Hidden pages are
 * already unreachable, so a hit here is a stray prefetch or a stale client —
 * answering 404 keeps it from running multi-join queries.
 */
export function isKriHiddenApiPath(pathname: string): boolean {
    return matchesHiddenModule(pathname, API_MODULE_KEYS)
}

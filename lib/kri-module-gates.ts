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

export function isKriHiddenPath(pathname: string): boolean {
    const match = PATH_MODULE_KEYS.find(
        (entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`),
    )
    if (!match) return false
    return MODULE_FLAGS[match.key] === false
}

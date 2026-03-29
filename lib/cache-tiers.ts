/**
 * Cache tier system for TanStack Query.
 *
 * Each tier defines staleTime and gcTime for a category of data.
 * Use these in useQuery() calls and in the routePrefetchMap to override
 * the global default (5 min staleTime).
 *
 * See docs/features/prefetch-architecture.md Section 1 for rationale.
 */

export const CACHE_TIERS = {
    /** T1: System settings — almost never changes (fiscal periods, permissions, numbering) */
    CONFIG: {
        staleTime: 24 * 60 * 60 * 1000,       // 24 hours
        gcTime: 7 * 24 * 60 * 60 * 1000,       // 7 days
        refetchOnWindowFocus: false as const,
    },
    /** T2: Reference data — changes weekly (units, brands, colors, categories, warehouses, GL structure) */
    MASTER: {
        staleTime: 30 * 60 * 1000,             // 30 minutes
        gcTime: 7 * 24 * 60 * 60 * 1000,       // 7 days
        refetchOnWindowFocus: false as const,
    },
    /** T3: Reference data — changes more often (products, customers, vendors, employees, BOMs) */
    MASTER_PLUS: {
        staleTime: 10 * 60 * 1000,             // 10 minutes
        gcTime: 7 * 24 * 60 * 60 * 1000,       // 7 days
        refetchOnWindowFocus: false as const,
    },
    /** T4: Aggregated stats — changes on every transaction (dashboards, KPIs, reports) */
    DASHBOARD: {
        staleTime: 3 * 60 * 1000,              // 3 minutes
        gcTime: 24 * 60 * 60 * 1000,           // 1 day
        refetchOnWindowFocus: true as const,
    },
    /** T5: Live operational records — changes frequently (invoices, POs, journal entries) */
    TRANSACTIONAL: {
        staleTime: 60 * 1000,                  // 60 seconds
        gcTime: 24 * 60 * 60 * 1000,           // 1 day
        refetchOnWindowFocus: true as const,
    },
    /** T6: Critical approval/alert data — needs near-realtime freshness */
    REALTIME: {
        staleTime: 30 * 1000,                  // 30 seconds
        gcTime: 60 * 60 * 1000,                // 1 hour
        refetchOnWindowFocus: true as const,
    },
} as const

export type CacheTier = keyof typeof CACHE_TIERS

/**
 * Route-to-tier mapping.
 * Used by CacheWarmingOverlay to apply correct staleTime when prefetching.
 */
export const ROUTE_TIERS: Record<string, CacheTier> = {
    // ── Dashboards (T4) ──
    "/dashboard":                     "DASHBOARD",
    "/inventory":                     "DASHBOARD",
    "/sales":                         "DASHBOARD",
    "/finance":                       "DASHBOARD",
    "/procurement":                   "DASHBOARD",
    "/manufacturing":                 "DASHBOARD",
    "/hcm":                           "DASHBOARD",
    "/subcontract":                   "DASHBOARD",
    "/costing":                       "DASHBOARD",
    "/cutting":                       "DASHBOARD",
    "/sales/sales":                   "DASHBOARD",
    "/finance/reports":               "DASHBOARD",
    "/finance/cashflow-forecast":     "DASHBOARD",
    "/finance/planning":              "DASHBOARD",
    "/finance/planning/simulasi":     "DASHBOARD",
    "/finance/planning/aktual":       "DASHBOARD",

    // ── Master data (T2) ──
    "/inventory/categories":          "MASTER",
    "/inventory/warehouses":          "MASTER",
    "/finance/chart-accounts":        "MASTER",
    "/finance/currencies":            "MASTER",      // actually T1 but COA-adjacent
    "/manufacturing/groups":          "MASTER",
    "/manufacturing/routing":         "MASTER",
    "/manufacturing/processes":       "MASTER",
    "/hcm/onboarding":               "MASTER",

    // ── Master+ data (T3) ──
    "/inventory/products":            "MASTER_PLUS",
    "/inventory/fabric-rolls":        "MASTER_PLUS",
    "/inventory/opening-stock":       "MASTER_PLUS",
    "/sales/customers":               "MASTER_PLUS",
    "/sales/discounts":               "MASTER_PLUS",
    "/sales/salespersons":            "MASTER_PLUS",
    "/sales/pricelists":              "MASTER_PLUS",
    "/procurement/vendors":           "MASTER_PLUS",
    "/manufacturing/bom":             "MASTER_PLUS",
    "/manufacturing/work-centers":    "MASTER_PLUS",
    "/hcm/employee-master":           "MASTER_PLUS",
    "/hcm/shifts":                    "MASTER_PLUS",
    "/subcontract/registry":          "MASTER_PLUS",
    "/costing/sheets":                "MASTER_PLUS",
    "/finance/fixed-assets":          "MASTER_PLUS",
    "/finance/opening-balances":      "MASTER_PLUS",
    "/documents":                     "MASTER_PLUS",

    // ── Transactional (T5) ──
    "/sales/orders":                  "TRANSACTIONAL",
    "/sales/leads":                   "TRANSACTIONAL",
    "/sales/quotations":              "TRANSACTIONAL",
    "/finance/invoices":              "TRANSACTIONAL",
    "/finance/journal":               "TRANSACTIONAL",
    "/finance/vendor-payments":       "TRANSACTIONAL",
    "/finance/bills":                 "TRANSACTIONAL",
    "/finance/credit-notes":          "TRANSACTIONAL",
    "/finance/receivables":           "TRANSACTIONAL",
    "/finance/payables":              "TRANSACTIONAL",
    "/finance/expenses":              "TRANSACTIONAL",
    "/finance/petty-cash":            "TRANSACTIONAL",
    "/finance/transactions":          "TRANSACTIONAL",
    "/finance/reconciliation":        "TRANSACTIONAL",
    "/procurement/orders":            "TRANSACTIONAL",
    "/procurement/requests":          "TRANSACTIONAL",
    "/procurement/receiving":         "TRANSACTIONAL",
    "/inventory/movements":           "TRANSACTIONAL",
    "/inventory/adjustments":         "TRANSACTIONAL",
    "/inventory/audit":               "TRANSACTIONAL",
    "/inventory/cycle-counts":        "TRANSACTIONAL",
    "/inventory/transfers":           "TRANSACTIONAL",
    "/manufacturing/orders":          "TRANSACTIONAL",
    "/manufacturing/work-orders":     "TRANSACTIONAL",
    "/manufacturing/quality":         "TRANSACTIONAL",
    "/manufacturing/material-demand": "TRANSACTIONAL",
    "/manufacturing/planning":        "TRANSACTIONAL",
    "/manufacturing/schedule":        "TRANSACTIONAL",
    "/subcontract/orders":            "TRANSACTIONAL",
    "/cutting/plans":                 "TRANSACTIONAL",
    "/hcm/payroll":                   "TRANSACTIONAL",
    "/staff":                         "TRANSACTIONAL",
    "/manager":                       "TRANSACTIONAL",

    // ── Realtime (T6) ──
    "/dashboard/approvals":           "REALTIME",
    "/hcm/attendance":                "REALTIME",

    "/finance/payments":              "TRANSACTIONAL",
    "/finance/receivables#payments":  "TRANSACTIONAL",
    "/finance/payables#bills":        "TRANSACTIONAL",
    "/finance/payables#banks":        "MASTER",
    "/finance/vendor-payments#banks": "MASTER",
    "/finance/planning#accuracy":     "DASHBOARD",
    "/finance/planning#obligations":  "DASHBOARD",
    "/finance/planning/simulasi#scenarios": "DASHBOARD",
    "/sales/salespersons#commission":     "DASHBOARD",
    "/hcm#snapshot":                      "REALTIME",
    "/hcm/payroll#compliance":            "TRANSACTIONAL",
    "/finance/fixed-assets/depreciation": "TRANSACTIONAL",

    // ── Realtime (T6) ──
    // (moved above)

    // ── Config (T1) ──
    "/settings/numbering":            "CONFIG",
    "/settings/permissions":          "CONFIG",
    "/settings":                      "CONFIG",
    "/finance/fiscal-periods":        "CONFIG",
    "/inventory/settings":            "CONFIG",

    // ── New routes (audit 2026-03-27) ──
    "/finance/fixed-assets/categories":  "MASTER",
    "/finance/fixed-assets/reports":     "DASHBOARD",
    "/accountant/coa":                   "MASTER",
}

/**
 * Master data key-to-tier mapping (for masterDataPrefetchMap entries).
 */
export const MASTER_DATA_TIERS: Record<string, CacheTier> = {
    units:            "MASTER",
    brands:           "MASTER",
    colors:           "MASTER",
    masterCategories: "MASTER",
    uomConversions:   "MASTER",
    glAccounts:       "MASTER",
    bankAccounts:     "MASTER",
    suppliers:        "MASTER_PLUS",
    salesOptions:     "MASTER_PLUS",
    sidebarActions:   "DASHBOARD",
    paymentTerms:     "MASTER",
    ceoFlags:         "DASHBOARD",
}

/**
 * Get the cache tier config for a route.
 * Falls back to DASHBOARD (5min staleTime) if route is not mapped.
 */
export function getTierForRoute(route: string): typeof CACHE_TIERS[CacheTier] {
    const tier = ROUTE_TIERS[route]
    return tier ? CACHE_TIERS[tier] : CACHE_TIERS.DASHBOARD
}

/**
 * Get the cache tier config for a master data key.
 */
export function getTierForMasterData(key: string): typeof CACHE_TIERS[CacheTier] {
    const tier = MASTER_DATA_TIERS[key]
    return tier ? CACHE_TIERS[tier] : CACHE_TIERS.MASTER
}

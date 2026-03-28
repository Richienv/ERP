/**
 * Prefetch Manifest — organizes routes by download priority.
 *
 * P1 (Critical):  Blocks the loading screen (progress 0–60%). Landing pages + master data.
 * P2 (Important): Still blocks the loading screen (progress 60–90%). Second-click pages.
 * P3 (Background): Runs AFTER the app is interactive (progress 90–100%). No UI.
 *
 * See docs/features/prefetch-architecture.md Section 2 for the full rationale.
 */

// ── Priority 1: Critical — blocks UI until complete ────────────────────────

/** Landing pages + most-used sub-pages. Progress bar 0–60%. */
export const P1_ROUTES = [
    // Landing pages (what user sees first)
    "/dashboard",
    "/inventory",
    "/sales",
    "/finance",
    "/procurement",
    "/manufacturing",
    // Most-clicked sub-pages
    "/inventory/products",
    "/sales/customers",
    "/sales/orders",
    "/finance/invoices",
    "/procurement/orders",
    "/manufacturing/bom",
] as const

/** Master data keys from masterDataPrefetchMap — fetched as part of P1. */
export const P1_MASTER_DATA = [
    "units",
    "brands",
    "colors",
    "masterCategories",
    "suppliers",
    "uomConversions",
    "glAccounts",
    "bankAccounts",
    "salesOptions",
    "sidebarActions",
] as const

// ── Priority 2: Important — still blocks loading screen ────────────────────

/** Second-click pages. Progress bar 60–90%. */
export const P2_ROUTES = [
    // Sales
    "/sales/leads",
    "/sales/quotations",
    "/sales/discounts",
    "/sales/salespersons",
    "/sales/pricelists",
    "/sales/sales",
    // Procurement
    "/procurement/requests",
    "/procurement/vendors",
    "/procurement/receiving",
    // Finance
    "/finance/journal",
    "/finance/chart-accounts",
    "/finance/vendor-payments",
    "/finance/vendor-payments#banks",
    "/finance/bills",
    "/finance/receivables",
    "/finance/receivables#payments",
    "/finance/payables",
    "/finance/payables#bills",
    "/finance/payables#banks",
    "/finance/expenses",
    "/finance/petty-cash",
    "/finance/credit-notes",
    "/finance/payments",
    // Inventory
    "/inventory/categories",
    "/inventory/warehouses",
    "/inventory/movements",
    "/inventory/adjustments",
    "/inventory/fabric-rolls",
    "/inventory/transfers",
    // Manufacturing
    "/manufacturing/work-centers",
    "/manufacturing/orders",
    "/manufacturing/quality",
    "/manufacturing/groups",
    "/manufacturing/routing",
    // HCM
    "/hcm/employee-master",
    "/hcm",
    // Approvals
    "/dashboard/approvals",
] as const

// ── Priority 3: Background — runs after app is interactive ─────────────────

/** Everything else. Batch 4, 150ms gaps. No UI indicator. */
export const P3_ROUTES = [
    // Inventory remaining
    "/inventory/audit",
    "/inventory/cycle-counts",
    "/inventory/opening-stock",
    "/inventory/settings",
    // Finance remaining
    "/finance/transactions",
    "/finance/reports",
    "/finance/reconciliation",
    "/finance/currencies",
    "/finance/fiscal-periods",
    "/finance/opening-balances",
    "/finance/cashflow-forecast",
    "/finance/planning",
    "/finance/planning#accuracy",
    "/finance/planning#obligations",
    "/finance/planning/simulasi",
    "/finance/planning/simulasi#scenarios",
    "/finance/planning/aktual",
    "/finance/fixed-assets",
    "/finance/fixed-assets/categories",
    "/finance/fixed-assets/depreciation",
    "/finance/fixed-assets/reports",
    // Manufacturing remaining
    "/manufacturing/material-demand",
    "/manufacturing/planning",
    "/manufacturing/work-orders",
    "/manufacturing/schedule",
    "/manufacturing/processes",
    // HCM remaining
    "/hcm/attendance",
    "/hcm/shifts",
    "/hcm/onboarding",
    "/hcm/payroll",
    // Subcontract
    "/subcontract",
    "/subcontract/orders",
    "/subcontract/registry",
    // Costing
    "/costing",
    "/costing/sheets",
    // Cutting
    "/cutting",
    "/cutting/plans",
    // Documents
    "/documents",
    // Staff / Manager
    "/staff",
    "/manager",
    // Settings
    "/settings/numbering",
    "/settings/permissions",
    "/settings",
    // Accountant
    "/accountant/coa",
] as const

// ── Counts for progress bar weighting ──────────────────────────────────────

export const P1_TOTAL = P1_ROUTES.length + P1_MASTER_DATA.length  // 12 + 10 = 22
export const P2_TOTAL = P2_ROUTES.length                           // 37
export const P3_TOTAL = P3_ROUTES.length                           // 44

/**
 * Progress bar weight mapping:
 *   P1 → 0–60%  (each P1 item = 60/22 ≈ 2.7%)
 *   P2 → 60–90% (each P2 item = 30/33 ≈ 0.9%)
 *   P3 → invisible (app already interactive at 90%)
 */
export const PROGRESS_WEIGHTS = {
    P1_START: 0,
    P1_END: 60,
    P2_START: 60,
    P2_END: 90,
    // P3 is invisible — no progress shown
} as const

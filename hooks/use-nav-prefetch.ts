"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getTierForRoute } from "@/lib/cache-tiers"
import { isKriHiddenPath } from "@/lib/kri-module-gates"
import { isModuleEnabled, type ModuleKey } from "@/lib/sidebar-feature-flags"
// KRI hot reads go through HTTP + apiFetch so a failed prefetch throws
// (TanStack keeps stale) instead of caching empty tables.
import { getARPaymentRegistry, getARPaymentStats } from "@/lib/actions/finance-ar"
import { getPurchaseRequests } from "@/lib/actions/procurement"
import { getChartOfAccountsTree } from "@/lib/actions/finance-gl"
import { fetchStockMovementsBundle } from "@/hooks/use-stock-movements"
import { getPettyCashTransactions } from "@/lib/actions/finance-petty-cash"
import { getExpenses, getExpenseAccounts, getARAgingReport, getAPAgingReport } from "@/lib/actions/finance"
import { fetchPurchaseOrdersPage } from "@/hooks/use-purchase-orders"
import { getWarehouses } from "@/app/actions/inventory"
import { getVendors as getVendorList } from "@/app/actions/vendor"
import { getPayrollRun, getPayrollComplianceReport, getEmployees } from "@/app/actions/hcm"
import { getVehicles, getVehicleStats } from "@/lib/actions/vehicles"
import { apiFetch } from "@/lib/http/api-fetch"

/** Helper: fetch JSON from an API route. Throws on error so TanStack Query
 *  treats failures as errors (keeps stale data) instead of caching empty fallbacks. */
const fetchJson = async (url: string, _fallback?: unknown) => {
    return apiFetch(url)
}
/**
 * Maps sidebar routes to their data prefetch config.
 * Used for hover-prefetch on sidebar and background master data prefetch.
 */
export const routePrefetchMap: Record<string, { queryKey: readonly unknown[]; queryFn: () => Promise<unknown> }> = {
    "/sales/customers": {
        queryKey: queryKeys.customers.list(),
        queryFn: () => fetch("/api/sales/customers").then((r) => r.json()).then((p) => ({
            customers: p.data || [],
            summary: p.summary || {},
        })),
    },
    "/sales/orders": {
        queryKey: queryKeys.salesOrders.list(),
        queryFn: () => fetch("/api/sales/orders").then((r) => r.json()).then((p) => ({
            orders: p.data || [],
            summary: p.summary || {},
        })),
    },
    "/sales/leads": {
        queryKey: queryKeys.leads.list(),
        queryFn: () => fetch("/api/sales/leads").then((r) => r.json()).then((p) => ({
            leads: p.data || [],
            summary: p.summary || {},
        })),
    },
    "/sales/discounts": {
        queryKey: queryKeys.discounts.list(),
        queryFn: () => fetch("/api/sales/discounts").then((r) => r.json()).then((p) => ({
            schemes: p.data || [],
            summary: p.summary || {},
        })),
    },
    "/sales/salespersons": {
        queryKey: queryKeys.salespersons.list(),
        queryFn: () => fetch("/api/sales/salespersons").then((r) => r.json()).then((p) => ({
            salespersons: p.data || [],
            summary: p.summary || {},
        })),
    },
    // Companion — salespersons page also shows commission report for current month
    "/sales/salespersons#commission": {
        queryKey: queryKeys.salespersons.commissionReport(
            new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
            new Date().toISOString().slice(0, 10)
        ),
        queryFn: () => {
            const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
            const end = new Date().toISOString().slice(0, 10)
            return fetch(`/api/sales/salespersons/commission-report?startDate=${start}&endDate=${end}`).then(r => r.json())
        },
    },
    "/inventory/categories": {
        queryKey: queryKeys.categories.list(),
        queryFn: () => fetchJson("/api/inventory/categories-data", { categories: [], allCategories: [] }),
    },
    "/inventory/products": {
        queryKey: queryKeys.products.list(),
        queryFn: async () => {
            const p = await apiFetch<{
                products?: unknown[]
                categories?: unknown[]
                warehouses?: unknown[]
                stats?: Record<string, number>
            }>("/api/inventory/page-data")
            return {
                products: p.products ?? [],
                categories: p.categories ?? [],
                warehouses: p.warehouses ?? [],
                stats: p.stats ?? { total: 0, healthy: 0, lowStock: 0, critical: 0, newArrivals: 0, planning: 0, incoming: 0, totalValue: 0 },
            }
        },
    },
    "/inventory/stock": {
        queryKey: queryKeys.products.list(),
        queryFn: async () => {
            const p = await apiFetch<{
                products?: unknown[]
                categories?: unknown[]
                warehouses?: unknown[]
                stats?: Record<string, number>
            }>("/api/inventory/page-data")
            return {
                products: p.products ?? [],
                categories: p.categories ?? [],
                warehouses: p.warehouses ?? [],
                stats: p.stats ?? { total: 0, healthy: 0, lowStock: 0, critical: 0, newArrivals: 0, planning: 0, incoming: 0, totalValue: 0 },
            }
        },
    },
    "/inventory/alerts": {
        queryKey: queryKeys.products.list(),
        queryFn: async () => {
            const p = await apiFetch<{
                products?: unknown[]
                categories?: unknown[]
                warehouses?: unknown[]
                stats?: Record<string, number>
            }>("/api/inventory/page-data")
            return {
                products: p.products ?? [],
                categories: p.categories ?? [],
                warehouses: p.warehouses ?? [],
                stats: p.stats ?? { total: 0, healthy: 0, lowStock: 0, critical: 0, newArrivals: 0, planning: 0, incoming: 0, totalValue: 0 },
            }
        },
    },
    "/manufacturing/bom": {
        queryKey: queryKeys.productionBom.list(),
        queryFn: () => fetch("/api/manufacturing/production-bom").then((r) => r.json()).then((p) => (p.success ? p.data : [])),
    },
    "/manufacturing/processes": {
        queryKey: [...queryKeys.processStations.list(), { includeInactive: true }],
        queryFn: () => fetch("/api/manufacturing/process-stations?activeOnly=false").then((r) => r.json()).then((p) => (p.success ? p.data : [])),
    },
    "/manufacturing/orders": {
        queryKey: queryKeys.workOrders.list(),
        queryFn: () => fetch("/api/manufacturing/work-orders?orderType=MO").then((r) => r.json()).then((p) => ({
            orders: p.success ? p.data : [],
            summary: p.success ? p.summary : { planned: 0, inProgress: 0, completed: 0, onHold: 0 },
        })),
    },
    "/hcm/employee-master": {
        queryKey: queryKeys.employees.list(),
        queryFn: () => getEmployees({ includeInactive: true }),
    },
    "/sales/quotations": {
        queryKey: queryKeys.quotations.list(),
        queryFn: () => fetchJson("/api/sales/quotations-data", []),
    },
    "/procurement/orders": {
        queryKey: queryKeys.purchaseOrders.list(),
        queryFn: fetchPurchaseOrdersPage,
    },
    "/inventory/fabric-rolls": {
        queryKey: queryKeys.fabricRolls.list(),
        queryFn: () => fetchJson("/api/inventory/fabric-rolls-data", { rolls: [], warehouses: [], products: [] }),
    },
    "/inventory/transfers": {
        queryKey: queryKeys.stockTransfers.list(),
        queryFn: () => fetchJson("/api/inventory/transfers-data", { transfers: [], warehouses: [], products: [] }),
    },
    "/sales/sales": {
        queryKey: queryKeys.salesDashboard.list(),
        queryFn: () => fetch("/api/sales/dashboard").then((r) => r.json()).then((p) => ({
            invoices: p.invoices ?? [],
            stats: p.stats ?? {},
        })),
    },
    "/finance": {
        queryKey: queryKeys.financeDashboard.list(),
        queryFn: () => apiFetch("/api/finance/lists/dashboard"),
    },
    "/procurement/requests": {
        queryKey: queryKeys.purchaseRequests.list(),
        queryFn: () => getPurchaseRequests(),
    },
    "/procurement/vendors": {
        queryKey: queryKeys.vendors.list(),
        queryFn: () => getVendorList(),
    },
    "/procurement/receiving": {
        queryKey: queryKeys.receiving.list(),
        queryFn: () => fetchJson("/api/procurement/receiving-data", { pendingPOs: [], grns: [], warehouses: [], employees: [] }),
    },
    "/finance/journal": {
        queryKey: queryKeys.journal.list(),
        queryFn: () => apiFetch("/api/finance/lists/journal"),
    },
    "/finance/chart-accounts": {
        queryKey: queryKeys.chartAccounts.list(),
        queryFn: () => getChartOfAccountsTree(),
    },
    "/finance/vendor-payments": {
        queryKey: queryKeys.vendorPayments.list(),
        queryFn: () => apiFetch("/api/finance/lists/vendor-payments"),
    },
    // Companion — vendor-payments page also needs bank accounts dropdown
    "/finance/vendor-payments#banks": {
        queryKey: queryKeys.glAccounts.bankAccounts(),
        queryFn: () => fetchJson("/api/master/bank-accounts", []),
    },
    "/manufacturing": {
        queryKey: queryKeys.mfgDashboard.list(),
        queryFn: () => fetch("/api/manufacturing/dashboard").then((r) => r.json()).then((p) => (p.success ? p.data : {})),
    },
    "/manufacturing/work-centers": {
        queryKey: [...queryKeys.processStations.list(), { includeInactive: true }],
        queryFn: () => fetch("/api/manufacturing/process-stations?activeOnly=false").then((r) => r.json()).then((p) => (p.success ? p.data : [])),
    },
    "/manufacturing/groups": {
        queryKey: queryKeys.mfgGroups.list(),
        queryFn: () => fetch("/api/manufacturing/groups").then((r) => r.json()).then((p) => (p.success ? p.data : [])),
    },
    "/manufacturing/routing": {
        queryKey: queryKeys.mfgRouting.list(),
        queryFn: () => fetch("/api/manufacturing/routing").then((r) => r.json()).then((p) => (p.success ? p.data : [])),
    },
    "/manufacturing/material-demand": {
        queryKey: queryKeys.materialDemand.list(),
        queryFn: () => fetch("/api/manufacturing/material-demand").then((r) => r.json()),
    },
    "/manufacturing/planning": {
        queryKey: queryKeys.mfgPlanning.list(),
        queryFn: () => fetch("/api/manufacturing/planning?weeks=4").then((r) => r.json()).then((p) => ({
            data: p.success ? p.data : { weeklySchedule: [], workOrders: [], machines: [] },
            summary: p.success ? p.summary : {},
        })),
    },
    "/manufacturing/work-orders": {
        queryKey: queryKeys.spkOrders.list(),
        queryFn: () => fetch("/api/manufacturing/work-orders?orderType=SPK").then((r) => r.json()).then((p) => (p.success ? p.data : [])),
    },
    "/finance/bills": {
        queryKey: [...queryKeys.bills.list(), { q: null, status: null, page: 1, pageSize: 20 }],
        queryFn: () => apiFetch("/api/finance/lists/bills?page=1&pageSize=20"),
    },
    "/finance/credit-notes": {
        queryKey: queryKeys.dcNotes.list(),
        queryFn: () => fetchJson("/api/finance/credit-notes-data", []),
    },
    "/finance/receivables": {
        queryKey: ["finance", "ar-aging"] as const,
        queryFn: () => getARAgingReport(),
    },
    // Companion query for receivables default tab (payments)
    // Must use server actions (not API route) to match useARPayments hook shape
    "/finance/receivables#payments": {
        queryKey: queryKeys.arPayments.all,
        queryFn: async () => {
            const [registry, stats] = await Promise.all([
                getARPaymentRegistry(),
                getARPaymentStats(),
            ])
            return { registry, stats }
        },
    },
    "/manufacturing/schedule": {
        queryKey: queryKeys.mfgSchedule.list(),
        queryFn: () => fetchJson("/api/manufacturing/schedule-data", { workOrders: [], machines: [], routings: [] }),
    },
    "/manufacturing/quality": {
        queryKey: queryKeys.mfgQuality.list(),
        queryFn: () => fetch("/api/manufacturing/quality").then((r) => r.json()).then((p) => ({
            inspections: p.success ? p.data : [],
            pendingQueue: p.success ? (p.pendingQueue || []) : [],
            summary: p.success ? p.summary : { passRate: 100, defectCount: 0, pendingCount: 0, todayCount: 0 },
        })),
    },
    "/dashboard": {
        queryKey: queryKeys.executiveDashboard.financials(),
        queryFn: () => apiFetch("/api/dashboard/financials"),
    },
    // Companion — mining command pulse rendered on the executive dashboard
    "/dashboard#pulse": {
        queryKey: queryKeys.miningCommand.pulse(),
        queryFn: () => apiFetch("/api/mining/pulse"),
    },
    "/fleet": {
        queryKey: queryKeys.fleet.list(),
        queryFn: async () => {
            const [vehicles, stats] = await Promise.all([
                getVehicles(),
                getVehicleStats(),
            ])
            return { vehicles, stats }
        },
    },
    "/inventory": {
        queryKey: queryKeys.inventoryDashboard.list(),
        queryFn: () => apiFetch("/api/inventory/dashboard"),
    },
    "/inventory#stats": {
        queryKey: queryKeys.inventoryDashboard.stats(),
        queryFn: () => apiFetch("/api/inventory/stats"),
    },
    "/procurement": {
        queryKey: queryKeys.procurementDashboard.list(),
        queryFn: () => apiFetch("/api/procurement/dashboard"),
    },
    "/sales": {
        queryKey: queryKeys.salesPage.list(),
        queryFn: () => fetch("/api/sales/page-data").then((r) => r.json()).then((p) => p.data ?? {}),
    },
    "/staff": {
        queryKey: queryKeys.staffTasks.list(),
        queryFn: () => fetchJson("/api/tasks/staff", []),
    },
    "/manager": {
        queryKey: queryKeys.managerDashboard.list(),
        queryFn: () => fetchJson("/api/tasks/manager", { tasks: [], employees: [], orders: [], dashboard: {} }),
    },
    "/subcontract": {
        queryKey: queryKeys.subcontractDashboard.list(),
        queryFn: () => fetchJson("/api/subcontract/dashboard-data", {}),
    },
    "/subcontract/orders": {
        queryKey: queryKeys.subcontractOrders.list(),
        queryFn: () => fetchJson("/api/subcontract/orders-data", { orders: [], subcontractors: [], products: [] }),
    },
    "/subcontract/registry": {
        queryKey: queryKeys.subcontractRegistry.list(),
        queryFn: () => fetchJson("/api/subcontract/registry-data", { subcontractors: [] }),
    },
    "/hcm/attendance": {
        queryKey: queryKeys.hcmAttendance.list(),
        queryFn: () => fetchJson("/api/hcm/attendance-full", { initialSnapshot: {}, initialEmployees: [], initialLeaveRequests: [] }),
    },
    "/hcm/shifts": {
        queryKey: queryKeys.hcmShifts.list(),
        queryFn: () => fetchJson("/api/hcm/shifts-data", { schedule: [], employees: [], currentWeekStart: "" }),
    },
    "/hcm/onboarding": {
        queryKey: queryKeys.hcmOnboarding.list(),
        queryFn: () => fetchJson("/api/hcm/onboarding-data", { templates: [] }),
    },
    "/costing": {
        queryKey: queryKeys.costingDashboard.list(),
        queryFn: () => fetchJson("/api/costing/dashboard-data", { data: {}, products: [] }),
    },
    "/costing/sheets": {
        queryKey: queryKeys.costSheets.list(),
        queryFn: () => fetchJson("/api/costing/sheets-data", { initialSheets: [], products: [] }),
    },
    "/dashboard/approvals": {
        queryKey: queryKeys.approvals.list(),
        queryFn: () => fetchJson("/api/dashboard/approvals", { pendingPOs: [] }),
    },
    "/sales/pricelists": {
        queryKey: queryKeys.priceLists.list(),
        queryFn: () => fetchJson("/api/sales/pricelists-data", { initialPriceLists: [] }),
    },
    "/cutting": {
        queryKey: queryKeys.cuttingDashboard.list(),
        queryFn: () => fetchJson("/api/cutting/dashboard-data", { data: {}, fabricProducts: [] }),
    },
    "/cutting/plans": {
        queryKey: queryKeys.cutPlans.list(),
        queryFn: () => fetchJson("/api/cutting/plans-data", { plans: [], fabricProducts: [] }),
    },
    "/finance/reports": {
        queryKey: queryKeys.financeReports.list(
            new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
            new Date().toISOString().slice(0, 10)
        ),
        queryFn: async () => {
            const p = await apiFetch<{ kpi?: unknown; reports?: unknown; period?: unknown }>("/api/finance/reports")
            return { kpi: p.kpi, reports: p.reports, period: p.period }
        },
    },
    "/finance/reconciliation": {
        queryKey: queryKeys.reconciliation.list(),
        queryFn: () => apiFetch("/api/finance/reconciliation"),
    },
    "/finance/currencies": {
        queryKey: queryKeys.currencies.list(),
        queryFn: async () => {
            const p = await apiFetch<{ data?: unknown[]; success?: boolean }>("/api/finance/currencies")
            return p.data ?? []
        },
    },
    "/finance/fiscal-periods": {
        queryKey: queryKeys.fiscalPeriods.list(),
        queryFn: async () => {
            const p = await apiFetch<{ data?: unknown[] }>("/api/finance/fiscal-periods")
            return p.data ?? []
        },
    },
    "/documents": {
        queryKey: queryKeys.documents.list(),
        queryFn: () => fetchJson("/api/documents/overview", {}),
    },
    "/hcm": {
        queryKey: queryKeys.hcmDashboard.list(),
        queryFn: () => fetchJson("/api/hcm/dashboard-data", { attendance: {}, payroll: {}, leaves: { pendingCount: 0, requests: [] }, headcount: {} }),
    },
    // Companion — HCM dashboard also loads attendance snapshot for staff tables
    "/hcm#snapshot": {
        queryKey: [...queryKeys.hcmAttendance.all, "snapshot"] as const,
        queryFn: () => fetchJson("/api/hcm/attendance-snapshot", { date: "", rows: [], departments: [], stats: {} }),
    },
    "/finance/opening-balances": {
        queryKey: queryKeys.openingBalances.list(),
        queryFn: () => apiFetch("/api/finance/opening-balances"),
    },
    "/inventory/warehouses": {
        queryKey: queryKeys.warehouses.list(),
        queryFn: () => getWarehouses(),
    },
    "/finance/cashflow-forecast": {
        queryKey: queryKeys.cashflowForecast.list(6),
        queryFn: () => apiFetch("/api/finance/cashflow-forecast?months=6"),
    },
    "/finance/planning": {
        queryKey: [...queryKeys.cashflowPlan.list(new Date().getMonth() + 1, new Date().getFullYear()), false],
        queryFn: async () => {
            const m = new Date().getMonth() + 1
            const y = new Date().getFullYear()
            return apiFetch(`/api/finance/cashflow-plan?month=${m}&year=${y}`)
        },
    },
    // Companion queries for /finance/planning page
    "/finance/planning#accuracy": {
        queryKey: queryKeys.cashflowAccuracy.trend(3),
        queryFn: () => fetchJson("/api/finance/cashflow-accuracy?months=3", {}),
    },
    "/finance/planning#obligations": {
        queryKey: [...queryKeys.cashflowPlan.all, "upcoming", 90] as const,
        queryFn: () => fetchJson("/api/finance/cashflow-upcoming?days=90", []),
    },
    "/finance/planning/simulasi": {
        queryKey: [...queryKeys.cashflowPlan.list(new Date().getMonth() + 1, new Date().getFullYear()), true],
        queryFn: async () => {
            const m = new Date().getMonth() + 1
            const y = new Date().getFullYear()
            return apiFetch(`/api/finance/cashflow-plan?month=${m}&year=${y}&allStatuses=true`)
        },
    },
    // Companion — simulasi page also needs scenarios list
    "/finance/planning/simulasi#scenarios": {
        queryKey: queryKeys.cashflowScenarios.list(new Date().getMonth() + 1, new Date().getFullYear()),
        queryFn: async () => {
            const m = new Date().getMonth() + 1
            const y = new Date().getFullYear()
            const p = await apiFetch<{ scenarios?: unknown[] }>(`/api/finance/cashflow-scenarios?month=${m}&year=${y}`)
            return p.scenarios ?? []
        },
    },
    "/finance/planning/aktual": {
        queryKey: queryKeys.cashflowActual.list(new Date().getMonth() + 1, new Date().getFullYear()),
        queryFn: async () => {
            const m = new Date().getMonth() + 1
            const y = new Date().getFullYear()
            return apiFetch(`/api/finance/cashflow-actual?month=${m}&year=${y}`)
        },
    },
    // --- Inventory routes ---
    "/inventory/movements": {
        queryKey: queryKeys.stockMovements.list(),
        queryFn: () => fetchStockMovementsBundle(100),
    },
    "/inventory/adjustments": {
        queryKey: queryKeys.adjustments.list(),
        queryFn: () => fetchStockMovementsBundle(50),
    },
    "/inventory/audit": {
        queryKey: queryKeys.inventoryAudit.list(),
        queryFn: () => fetchJson("/api/inventory/audit-data", { audits: [], products: [], warehouses: [] }),
    },
    "/inventory/cycle-counts": {
        queryKey: queryKeys.cycleCounts.list(),
        queryFn: () => fetchJson("/api/inventory/cycle-counts-data", []),
    },
    "/inventory/opening-stock": {
        queryKey: queryKeys.openingStock.list(),
        queryFn: async () => {
            const p = await apiFetch<{
                products?: unknown[]
                warehouses?: unknown[]
                existingTransactions?: unknown[]
            }>("/api/inventory/opening-stock")
            return {
                products: p.products ?? [],
                warehouses: p.warehouses ?? [],
                existingTransactions: p.existingTransactions ?? [],
            }
        },
    },
    "/inventory/settings": {
        queryKey: queryKeys.inventorySettings.list(),
        queryFn: () => apiFetch("/api/inventory/settings"),
    },
    // --- Finance routes ---
    "/finance/invoices": {
        queryKey: queryKeys.invoices.kanban(),
        queryFn: () => apiFetch("/api/finance/lists/invoices"),
    },
    "/finance/petty-cash": {
        queryKey: queryKeys.pettyCash.list(),
        queryFn: () => getPettyCashTransactions(),
    },
    "/finance/transactions": {
        queryKey: [...queryKeys.accountTransactions.list(), {}],
        queryFn: async () => {
            const p = await apiFetch<{ entries?: unknown[]; accounts?: unknown[] }>("/api/finance/transactions?limit=500")
            return { entries: p.entries ?? [], accounts: p.accounts ?? [] }
        },
    },
    "/finance/expenses": {
        queryKey: queryKeys.expenses.list(),
        queryFn: async () => {
            const [expenses, accounts] = await Promise.all([
                getExpenses(),
                getExpenseAccounts(),
            ])
            return { expenses, ...accounts }
        },
    },
    // --- HCM route ---
    "/hcm/payroll": {
        queryKey: queryKeys.payroll.run(new Date().toISOString().slice(0, 7)),
        queryFn: async () => {
            const period = new Date().toISOString().slice(0, 7)
            const result = await getPayrollRun(period)
            if (!result.success) return null
            if ("exists" in result && !result.exists) return null
            if ("run" in result) return result.run
            return null
        },
    },
    // Companion — payroll page also shows compliance report
    "/hcm/payroll#compliance": {
        queryKey: queryKeys.payroll.compliance(new Date().toISOString().slice(0, 7)),
        queryFn: async () => {
            const period = new Date().toISOString().slice(0, 7)
            const result = await getPayrollComplianceReport(period)
            if (!result.success || !("report" in result) || !result.report) return null
            return result.report
        },
    },
    // --- Settings routes ---
    "/settings/numbering": {
        queryKey: queryKeys.documentNumbering.list(),
        queryFn: () => fetchJson("/api/settings/numbering-data", []),
    },
    "/settings/permissions": {
        queryKey: queryKeys.permissionMatrix.list(),
        queryFn: () => fetchJson("/api/settings/permissions-data", []),
    },
    // --- Fixed Assets ---
    "/finance/fixed-assets": {
        queryKey: queryKeys.fixedAssets.list(),
        queryFn: () => fetchJson("/api/finance/fixed-assets-data", { assets: [], summary: {}, categories: [] }),
    },
    "/finance/payables": {
        queryKey: ["finance", "ap-aging"] as const,
        queryFn: () => getAPAgingReport(),
    },
    // Companion queries for payables default tab (bills)
    "/finance/payables#bills": {
        queryKey: [...queryKeys.bills.list(), { q: null, status: null, page: 1, pageSize: 20 }],
        queryFn: () => apiFetch("/api/finance/lists/bills?page=1&pageSize=20"),
    },
    "/finance/payables#banks": {
        queryKey: ["banks", "list"] as const,
        queryFn: () => fetch("/api/xendit/banks").then(r => r.json()).then(p => ({
            banks: p.data?.banks ?? [],
            ewallets: p.data?.ewallets ?? [],
        })),
    },
    // --- Pages previously missing from prefetch (audit 2026-03-27) ---
    "/finance/payments": {
        queryKey: queryKeys.arPayments.all,
        queryFn: async () => {
            const [registry, stats] = await Promise.all([
                getARPaymentRegistry(),
                getARPaymentStats(),
            ])
            return { registry, stats }
        },
    },
    "/finance/fixed-assets/categories": {
        queryKey: queryKeys.fixedAssetCategories.list(),
        queryFn: () => fetchJson("/api/finance/fixed-assets/categories-data", { categories: [] }),
    },
    "/finance/fixed-assets/depreciation": {
        queryKey: queryKeys.depreciationRuns.list(),
        queryFn: () => fetchJson("/api/finance/fixed-assets/depreciation-data", { runs: [] }),
    },
    "/finance/fixed-assets/reports": {
        queryKey: queryKeys.fixedAssetReports.register(),
        queryFn: () => fetchJson("/api/finance/fixed-assets/reports-data", { assets: [] }),
    },
    "/accountant/coa": {
        queryKey: queryKeys.glAccounts.list(),
        queryFn: () => fetchJson("/api/accountant/coa-data", []),
    },
    "/settings": {
        queryKey: ["system-setting", "manufacturing.workingHoursPerMonth"] as const,
        queryFn: async () => {
            const res = await fetch("/api/system/settings?key=manufacturing.workingHoursPerMonth")
            const json = await res.json()
            const parsed = parseInt(json.value ?? "", 10)
            return isNaN(parsed) || parsed < 1 ? 172 : parsed
        },
    },
}

/**
 * Master data used by create/edit dialogs across the entire app.
 * Prefetched during cache warming so form opens are instant.
 */
export const masterDataPrefetchMap: Record<string, { queryKey: readonly unknown[]; queryFn: () => Promise<unknown> }> = {
    units: {
        queryKey: queryKeys.units.list(),
        queryFn: () => fetchJson("/api/master/units"),
    },
    brands: {
        queryKey: queryKeys.brands.list(),
        queryFn: () => fetchJson("/api/master/brands"),
    },
    colors: {
        queryKey: queryKeys.colors.list(),
        queryFn: () => fetchJson("/api/master/colors"),
    },
    masterCategories: {
        queryKey: queryKeys.categories.master(),
        queryFn: () => fetchJson("/api/master/categories"),
    },
    suppliers: {
        queryKey: queryKeys.suppliers.list(),
        queryFn: () => fetchJson("/api/master/suppliers"),
    },
    uomConversions: {
        queryKey: queryKeys.uomConversions.list(),
        queryFn: () => fetchJson("/api/master/uom-conversions"),
    },
    glAccounts: {
        queryKey: queryKeys.glAccounts.list(),
        queryFn: () => fetchJson("/api/master/gl-accounts", []),
    },
    bankAccounts: {
        queryKey: queryKeys.glAccounts.bankAccounts(),
        queryFn: () => fetchJson("/api/master/bank-accounts"),
    },
    // Sales pipeline dropdowns. `/api/sales/options` reads every active
    // customer, every active product with its stock levels, quotations,
    // salespeople and sales staff — only the hidden /sales/leads/new form uses
    // it, so it is registered here for hover prefetch but excluded from the
    // login-time warm (see isHiddenMasterDataKey).
    salesOptions: {
        queryKey: queryKeys.salesOptions.list(),
        queryFn: async () => {
            const res = await fetch("/api/sales/options")
            const payload = await res.json()
            return { customers: payload.data?.customers ?? [], users: payload.data?.users ?? [] }
        },
    },
    sidebarActions: {
        queryKey: queryKeys.sidebarActions.list(),
        queryFn: () => apiFetch("/api/sidebar/action-counts"),
    },
    paymentTerms: {
        queryKey: queryKeys.paymentTerms.list(),
        queryFn: () => fetchJson("/api/master/payment-terms"),
    },
    ceoFlags: {
        queryKey: ["ceo-flags", "count"] as const,
        queryFn: () => fetchJson("/api/dashboard/ceo-flags", { count: 0 }),
    },
}

/**
 * Master data keys that belong to a hidden module. Kept out of the login-time
 * warm so a KRI session never pays for sales pipeline dropdowns.
 */
const MASTER_DATA_MODULE_KEYS: Record<string, ModuleKey> = {
    salesOptions: "sales",
}

export function isHiddenMasterDataKey(key: string): boolean {
    const moduleKey = MASTER_DATA_MODULE_KEYS[key]
    return moduleKey ? !isModuleEnabled(moduleKey) : false
}

export function useNavPrefetch() {
    const router = useRouter()
    const queryClient = useQueryClient()

    const prefetchRoute = useCallback(
        (url: string) => {
            // Hidden modules redirect to /dashboard in middleware. Warming them
            // costs an RSC round trip plus a multi-join query for a page the
            // user can never open.
            if (isKriHiddenPath(url)) return

            router.prefetch(url)

            const companionPrefix = `${url}#`
            for (const [route, config] of Object.entries(routePrefetchMap)) {
                if (route !== url && !route.startsWith(companionPrefix)) continue
                const tier = getTierForRoute(route)
                queryClient.prefetchQuery({
                    queryKey: config.queryKey,
                    queryFn: config.queryFn,
                    staleTime: tier.staleTime,
                    gcTime: tier.gcTime,
                })
            }
        },
        [router, queryClient]
    )

    return { prefetchRoute }
}

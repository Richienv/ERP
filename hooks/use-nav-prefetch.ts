"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getTierForRoute } from "@/lib/cache-tiers"
import { getAllCategories, getCategories, getStockMovements, getRecentAudits, getProductsForKanban } from "@/app/actions/inventory"
import { getEmployees, getAttendanceSnapshot, getLeaveRequests, getPayrollRun } from "@/app/actions/hcm"
import { getQuotations, getAllPriceLists } from "@/lib/actions/sales"
import { getAllPurchaseOrders, getVendors, getPurchaseRequests, getPendingApprovalPOs } from "@/lib/actions/procurement"
import { getProductsForPO } from "@/app/actions/purchase-order"
import { getFabricRolls, getWarehousesForRolls, getFabricProducts } from "@/lib/actions/fabric-rolls"
import { getStockTransfers, getTransferFormData } from "@/lib/actions/stock-transfers"
import { getFinancialMetrics, getFinanceDashboardData, getJournalEntries, getGLAccountsList, getChartOfAccountsTree, getVendorPayments, getVendorBillsRegistry, getExpenses, getExpenseAccounts } from "@/lib/actions/finance"
import { getVendors as getVendorsList } from "@/app/actions/vendor"
import { getPendingPOsForReceiving, getAllGRNs, getWarehousesForGRN, getEmployeesForGRN } from "@/lib/actions/grn"
import { getSchedulableWorkOrders, getMachinesForScheduling, getRoutingsForScheduling } from "@/lib/actions/manufacturing-garment"
import { getStaffTasks, getManagerTasks, getDepartmentEmployees, getAssignableOrders, getManagerDashboardStats } from "@/lib/actions/tasks"
import { getSubcontractOrders, getSubcontractors, getProductsForSubcontract, getSubcontractDashboard } from "@/lib/actions/subcontract"
import { getCostingDashboard, getProductsForCostSheet, getCostSheets } from "@/lib/actions/costing"
import { getCuttingDashboard, getCutPlans, getFabricProducts as getCuttingFabricProducts } from "@/lib/actions/cutting"
import { getWeeklyShiftSchedule, getEmployeeShifts } from "@/lib/actions/hcm-shifts"
import { getOnboardingTemplates } from "@/lib/actions/hcm-onboarding"
import { getUnits, getBrands, getColors, getCategories as getMasterCategories, getSuppliers, getUomConversions } from "@/lib/actions/master-data"
import { getBankAccounts as getPettyCashBankAccounts } from "@/lib/actions/finance-petty-cash"
import { getCycleCountSessions } from "@/app/actions/cycle-count"
import { getInvoiceKanbanData } from "@/lib/actions/finance-invoices"
import { getPettyCashTransactions } from "@/lib/actions/finance-petty-cash"
import { getDocumentNumbering, getPermissionMatrix } from "@/lib/actions/settings"
import { getPaymentTerms } from "@/lib/actions/payment-terms"
import { getDocumentSystemOverview } from "@/app/actions/documents-system"
import { getHCMDashboardData } from "@/app/actions/hcm"
import { getWarehouses } from "@/app/actions/inventory"
import { getFixedAssets, getFixedAssetCategories, getDepreciationRuns, getGLAccountsForFixedAssets, getAssetRegisterReport, getNetBookValueSummary } from "@/lib/actions/finance-fixed-assets"
import { getGLAccounts } from "@/lib/actions/finance"
/**
 * Maps sidebar routes to their data prefetch config.
 * Used for both hover-prefetch and warm-cache-on-mount.
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
            return fetch(`/api/sales/salespersons/commission?startDate=${start}&endDate=${end}`).then(r => r.json())
        },
    },
    "/inventory/categories": {
        queryKey: queryKeys.categories.list(),
        queryFn: async () => {
            const [categories, allCategories] = await Promise.all([
                getAllCategories(),
                getCategories(),
            ])
            return { categories, allCategories }
        },
    },
    "/inventory/products": {
        queryKey: queryKeys.products.list(),
        queryFn: () => fetch("/api/inventory/page-data").then((r) => r.json()).then((p) => ({
            products: p.products ?? [],
            categories: p.categories ?? [],
            warehouses: p.warehouses ?? [],
            stats: p.stats ?? { total: 0, healthy: 0, lowStock: 0, critical: 0, totalValue: 0 },
        })),
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
        queryFn: async () => {
            const employees = await getEmployees({ includeInactive: true })
            return employees
        },
    },
    "/sales/quotations": {
        queryKey: queryKeys.quotations.list(),
        queryFn: async () => {
            const quotations = await getQuotations()
            return quotations
        },
    },
    "/procurement/orders": {
        queryKey: queryKeys.purchaseOrders.list(),
        queryFn: async () => {
            const [orders, vendorsRaw, products] = await Promise.all([
                getAllPurchaseOrders(),
                getVendors(),
                getProductsForPO(),
            ])
            const vendors = vendorsRaw.map((v: any) => ({ id: v.id, name: v.name, email: v.email, phone: v.phone }))
            return { orders, vendors, products }
        },
    },
    "/inventory/fabric-rolls": {
        queryKey: queryKeys.fabricRolls.list(),
        queryFn: async () => {
            const [rolls, warehouses, products] = await Promise.all([
                getFabricRolls(),
                getWarehousesForRolls(),
                getFabricProducts(),
            ])
            return { rolls, warehouses, products }
        },
    },
    "/inventory/transfers": {
        queryKey: queryKeys.stockTransfers.list(),
        queryFn: async () => {
            const [transfers, formData] = await Promise.all([
                getStockTransfers(),
                getTransferFormData(),
            ])
            return { transfers, warehouses: formData.warehouses, products: formData.products }
        },
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
        queryFn: async () => {
            const [metrics, dashboardData] = await Promise.all([
                getFinancialMetrics(),
                getFinanceDashboardData(),
            ])
            return { metrics, dashboardData }
        },
    },
    "/procurement/requests": {
        queryKey: queryKeys.purchaseRequests.list(),
        queryFn: async () => {
            return await getPurchaseRequests()
        },
    },
    "/procurement/vendors": {
        queryKey: queryKeys.vendors.list(),
        queryFn: async () => {
            return await getVendorsList()
        },
    },
    "/procurement/receiving": {
        queryKey: queryKeys.receiving.list(),
        queryFn: async () => {
            const [pendingPOs, grns, warehouses, employees] = await Promise.all([
                getPendingPOsForReceiving(),
                getAllGRNs(),
                getWarehousesForGRN(),
                getEmployeesForGRN(),
            ])
            return { pendingPOs, grns, warehouses, employees }
        },
    },
    "/finance/journal": {
        queryKey: queryKeys.journal.list(),
        queryFn: async () => {
            const [entries, accounts] = await Promise.all([
                getJournalEntries(50),
                getGLAccountsList(),
            ])
            return { entries, accounts }
        },
    },
    "/finance/chart-accounts": {
        queryKey: queryKeys.chartAccounts.list(),
        queryFn: async () => getChartOfAccountsTree(),
    },
    "/finance/vendor-payments": {
        queryKey: queryKeys.vendorPayments.list(),
        queryFn: async () => {
            const [payments, vendorsRaw] = await Promise.all([
                getVendorPayments(),
                getVendorsList(),
            ])
            const vendors = vendorsRaw.map((v: any) => ({ id: v.id, name: v.name }))
            return { payments, vendors }
        },
    },
    // Companion — vendor-payments page also needs bank accounts dropdown
    "/finance/vendor-payments#banks": {
        queryKey: queryKeys.glAccounts.bankAccounts(),
        queryFn: async () => {
            const { getBankAccounts } = await import("@/lib/actions/finance-petty-cash")
            const accounts = await getBankAccounts()
            return accounts.filter((a: any) => /^10\d{2}$/.test(a.code))
        },
    },
    "/manufacturing": {
        queryKey: queryKeys.mfgDashboard.list(),
        queryFn: () => fetch("/api/manufacturing/dashboard").then((r) => r.json()).then((p) => (p.success ? p.data : {})),
    },
    "/manufacturing/work-centers": {
        queryKey: queryKeys.machines.list(),
        queryFn: () => fetch("/api/manufacturing/machines").then((r) => r.json()).then((p) => ({
            machines: p.success ? p.data : [],
            summary: p.success ? p.summary : { total: 0, active: 0, down: 0, avgEfficiency: 0 },
        })),
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
        queryFn: async () => await getVendorBillsRegistry(),
    },
    "/finance/credit-notes": {
        queryKey: queryKeys.dcNotes.list(),
        queryFn: async () => {
            const { getDCNotes } = await import("@/lib/actions/finance-dcnotes")
            return await getDCNotes()
        },
    },
    "/finance/receivables": {
        queryKey: ["finance", "ar-aging"] as const,
        queryFn: async () => {
            const { getARAgingReport } = await import("@/lib/actions/finance")
            return await getARAgingReport()
        },
    },
    // Companion query for receivables default tab (payments)
    "/finance/receivables#payments": {
        queryKey: queryKeys.arPayments.all,
        queryFn: async () => {
            const { getARPaymentRegistry, getARPaymentStats } = await import("@/lib/actions/finance-ar")
            const [registry, stats] = await Promise.all([
                getARPaymentRegistry({}),
                getARPaymentStats(),
            ])
            return { registry, stats }
        },
    },
    "/manufacturing/schedule": {
        queryKey: queryKeys.mfgSchedule.list(),
        queryFn: async () => {
            const [workOrders, machines, routings] = await Promise.all([
                getSchedulableWorkOrders(),
                getMachinesForScheduling(),
                getRoutingsForScheduling(),
            ])
            return { workOrders, machines, routings }
        },
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
        queryKey: queryKeys.executiveDashboard.list(),
        queryFn: () => fetch("/api/dashboard").then((r) => r.json()).then((p) => p.data ?? {}),
    },
    "/inventory": {
        queryKey: queryKeys.inventoryDashboard.list(),
        queryFn: () => fetch("/api/inventory/dashboard").then((r) => r.json()),
    },
    "/procurement": {
        queryKey: queryKeys.procurementDashboard.list(),
        queryFn: () => fetch("/api/procurement/dashboard").then((r) => r.json()).then((p) => p.data ?? {}),
    },
    "/sales": {
        queryKey: queryKeys.salesPage.list(),
        queryFn: () => fetch("/api/sales/page-data").then((r) => r.json()).then((p) => p.data ?? {}),
    },
    "/staff": {
        queryKey: queryKeys.staffTasks.list(),
        queryFn: async () => await getStaffTasks(),
    },
    "/manager": {
        queryKey: queryKeys.managerDashboard.list(),
        queryFn: async () => {
            const [tasks, employees, orders, dashboard] = await Promise.all([
                getManagerTasks(),
                getDepartmentEmployees(),
                getAssignableOrders(),
                getManagerDashboardStats(),
            ])
            return { tasks, employees, orders, dashboard }
        },
    },
    "/subcontract": {
        queryKey: queryKeys.subcontractDashboard.list(),
        queryFn: async () => await getSubcontractDashboard(),
    },
    "/subcontract/orders": {
        queryKey: queryKeys.subcontractOrders.list(),
        queryFn: async () => {
            const [orders, subcontractors, products] = await Promise.all([
                getSubcontractOrders(),
                getSubcontractors(),
                getProductsForSubcontract(),
            ])
            return { orders, subcontractors, products }
        },
    },
    "/subcontract/registry": {
        queryKey: queryKeys.subcontractRegistry.list(),
        queryFn: async () => {
            const subcontractors = await getSubcontractors()
            return { subcontractors }
        },
    },
    "/hcm/attendance": {
        queryKey: queryKeys.hcmAttendance.list(),
        queryFn: async () => {
            const today = new Date().toISOString().slice(0, 10)
            const snapshot = await getAttendanceSnapshot({ date: today })
            const employees = await getEmployees({ includeInactive: false })
            const leaveRequests = await getLeaveRequests({ status: "ALL", limit: 30 })
            return { initialSnapshot: snapshot, initialEmployees: employees, initialLeaveRequests: leaveRequests }
        },
    },
    "/hcm/shifts": {
        queryKey: queryKeys.hcmShifts.list(),
        queryFn: async () => {
            const today = new Date()
            const dayOfWeek = today.getDay()
            const monday = new Date(today)
            monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7))
            const weekStart = monday.toISOString().split("T")[0]
            const [schedule, employees] = await Promise.all([
                getWeeklyShiftSchedule(weekStart),
                getEmployeeShifts(),
            ])
            return { schedule, employees, currentWeekStart: weekStart }
        },
    },
    "/hcm/onboarding": {
        queryKey: queryKeys.hcmOnboarding.list(),
        queryFn: async () => {
            const templates = await getOnboardingTemplates()
            return { templates }
        },
    },
    "/costing": {
        queryKey: queryKeys.costingDashboard.list(),
        queryFn: async () => {
            const [data, products] = await Promise.all([
                getCostingDashboard(),
                getProductsForCostSheet(),
            ])
            return { data, products }
        },
    },
    "/costing/sheets": {
        queryKey: queryKeys.costSheets.list(),
        queryFn: async () => {
            const [sheets, products] = await Promise.all([
                getCostSheets(),
                getProductsForCostSheet(),
            ])
            return { initialSheets: sheets, products }
        },
    },
    "/dashboard/approvals": {
        queryKey: queryKeys.approvals.list(),
        queryFn: async () => {
            const pendingPOs = await getPendingApprovalPOs()
            return { pendingPOs }
        },
    },
    "/sales/pricelists": {
        queryKey: queryKeys.priceLists.list(),
        queryFn: async () => {
            const priceLists = await getAllPriceLists()
            return { initialPriceLists: priceLists }
        },
    },
    "/cutting": {
        queryKey: queryKeys.cuttingDashboard.list(),
        queryFn: async () => {
            const [data, fabricProducts] = await Promise.all([
                getCuttingDashboard(),
                getCuttingFabricProducts(),
            ])
            return { data, fabricProducts }
        },
    },
    "/cutting/plans": {
        queryKey: queryKeys.cutPlans.list(),
        queryFn: async () => {
            const [plans, fabricProducts] = await Promise.all([
                getCutPlans(),
                getCuttingFabricProducts(),
            ])
            return { plans, fabricProducts }
        },
    },
    "/finance/reports": {
        queryKey: queryKeys.financeReports.list(
            new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
            new Date().toISOString().slice(0, 10)
        ),
        queryFn: () => fetch("/api/finance/reports").then((r) => r.json()).then((p) => ({
            kpi: p.kpi,
            reports: p.reports,
            period: p.period,
        })),
    },
    "/finance/reconciliation": {
        queryKey: queryKeys.reconciliation.list(),
        queryFn: () => fetch("/api/finance/reconciliation").then((r) => r.json()),
    },
    "/finance/currencies": {
        queryKey: queryKeys.currencies.list(),
        queryFn: () => fetch("/api/finance/currencies").then((r) => r.json()).then((p) => p.data ?? []),
    },
    "/finance/fiscal-periods": {
        queryKey: queryKeys.fiscalPeriods.list(),
        queryFn: () => fetch("/api/finance/fiscal-periods").then((r) => r.json()).then((p) => p.data ?? []),
    },
    "/documents": {
        queryKey: queryKeys.documents.list(),
        queryFn: async () => {
            const result = await getDocumentSystemOverview({ registryQuery: {} })
            if (!result.success || !("data" in result) || !result.data) throw new Error(("error" in result ? result.error : undefined) || "Failed")
            return result.data
        },
    },
    "/hcm": {
        queryKey: queryKeys.hcmDashboard.list(),
        queryFn: async () => {
            return await getHCMDashboardData()
        },
    },
    "/finance/opening-balances": {
        queryKey: queryKeys.openingBalances.list(),
        queryFn: () => fetch("/api/finance/opening-balances").then((r) => r.json()).then((p) => p.success ? p.data : {}),
    },
    "/inventory/warehouses": {
        queryKey: queryKeys.warehouses.list(),
        queryFn: async () => await getWarehouses(),
    },
    "/finance/cashflow-forecast": {
        queryKey: queryKeys.cashflowForecast.list(6),
        queryFn: () => fetch("/api/finance/cashflow-forecast?months=6").then((r) => r.json()),
    },
    "/finance/planning": {
        queryKey: [...queryKeys.cashflowPlan.list(new Date().getMonth() + 1, new Date().getFullYear()), false],
        queryFn: async () => {
            const m = new Date().getMonth() + 1
            const y = new Date().getFullYear()
            const res = await fetch(`/api/finance/cashflow-plan?month=${m}&year=${y}`)
            return res.json()
        },
    },
    // Companion queries for /finance/planning page
    "/finance/planning#accuracy": {
        queryKey: queryKeys.cashflowAccuracy.trend(3),
        queryFn: async () => {
            const { getAccuracyTrend } = await import("@/lib/actions/finance-cashflow")
            return await getAccuracyTrend(3)
        },
    },
    "/finance/planning#obligations": {
        queryKey: [...queryKeys.cashflowPlan.all, "upcoming", 90] as const,
        queryFn: async () => {
            const { getUpcomingObligations } = await import("@/lib/actions/finance-cashflow")
            return await getUpcomingObligations(90)
        },
    },
    "/finance/planning/simulasi": {
        queryKey: [...queryKeys.cashflowPlan.list(new Date().getMonth() + 1, new Date().getFullYear()), true],
        queryFn: async () => {
            const m = new Date().getMonth() + 1
            const y = new Date().getFullYear()
            const res = await fetch(`/api/finance/cashflow-plan?month=${m}&year=${y}&allStatuses=true`)
            return res.json()
        },
    },
    // Companion — simulasi page also needs scenarios list
    "/finance/planning/simulasi#scenarios": {
        queryKey: queryKeys.cashflowScenarios.list(new Date().getMonth() + 1, new Date().getFullYear()),
        queryFn: async () => {
            const { getCashflowScenarios } = await import("@/lib/actions/finance-cashflow")
            return await getCashflowScenarios(new Date().getMonth() + 1, new Date().getFullYear())
        },
    },
    "/finance/planning/aktual": {
        queryKey: queryKeys.cashflowActual.list(new Date().getMonth() + 1, new Date().getFullYear()),
        queryFn: async () => {
            const m = new Date().getMonth() + 1
            const y = new Date().getFullYear()
            const res = await fetch(`/api/finance/cashflow-actual?month=${m}&year=${y}`)
            return res.json()
        },
    },
    // --- Inventory routes ---
    "/inventory/movements": {
        queryKey: queryKeys.stockMovements.list(),
        queryFn: async () => {
            const [pageData, movements] = await Promise.all([
                fetch("/api/inventory/page-data").then((r) => r.json()),
                getStockMovements(100),
            ])
            return { ...pageData, movements }
        },
    },
    "/inventory/adjustments": {
        queryKey: queryKeys.adjustments.list(),
        queryFn: async () => {
            const [pageData, movements] = await Promise.all([
                fetch("/api/inventory/page-data").then((r) => r.json()),
                getStockMovements(50),
            ])
            return { ...pageData, movements }
        },
    },
    "/inventory/audit": {
        queryKey: queryKeys.inventoryAudit.list(),
        queryFn: async () => {
            const [audits, products, warehouses] = await Promise.all([
                getRecentAudits().catch(() => []),
                getProductsForKanban().catch(() => []),
                getWarehouses().catch(() => []),
            ])
            return { audits, products, warehouses }
        },
    },
    "/inventory/cycle-counts": {
        queryKey: queryKeys.cycleCounts.list(),
        queryFn: async () => await getCycleCountSessions(),
    },
    "/inventory/opening-stock": {
        queryKey: queryKeys.openingStock.list(),
        queryFn: () => fetch("/api/inventory/opening-stock").then((r) => r.json()).then((p) => ({
            products: p.products ?? [],
            warehouses: p.warehouses ?? [],
            existingTransactions: p.existingTransactions ?? [],
        })),
    },
    "/inventory/settings": {
        queryKey: queryKeys.inventorySettings.list(),
        queryFn: () => fetch("/api/inventory/settings").then((r) => r.json()),
    },
    // --- Finance routes ---
    "/finance/invoices": {
        queryKey: queryKeys.invoices.kanban(),
        queryFn: async () => {
            return await getInvoiceKanbanData({ q: null, type: "ALL" }).catch(() => ({ draft: [], sent: [], overdue: [], paid: [] }))
        },
    },
    "/finance/petty-cash": {
        queryKey: queryKeys.pettyCash.list(),
        queryFn: async () => {
            return await getPettyCashTransactions().catch(() => ({ transactions: [], currentBalance: 0, totalTopup: 0, totalDisbursement: 0 }))
        },
    },
    "/finance/transactions": {
        queryKey: [...queryKeys.accountTransactions.list(), {}],
        queryFn: () => fetch("/api/finance/transactions?limit=500").then((r) => r.json()).then((p) => ({
            entries: p.entries ?? [],
            accounts: p.accounts ?? [],
        })),
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
            return await getPayrollRun(period)
        },
    },
    // --- Settings routes ---
    "/settings/numbering": {
        queryKey: queryKeys.documentNumbering.list(),
        queryFn: async () => {
            const result = await getDocumentNumbering()
            return result && "data" in result ? result.data : []
        },
    },
    "/settings/permissions": {
        queryKey: queryKeys.permissionMatrix.list(),
        queryFn: async () => {
            const result = await getPermissionMatrix()
            return result && "data" in result ? result.data : []
        },
    },
    // --- Fixed Assets ---
    "/finance/fixed-assets": {
        queryKey: queryKeys.fixedAssets.list(),
        queryFn: async () => {
            const [assets, categories] = await Promise.all([
                getFixedAssets(),
                getFixedAssetCategories(),
            ])
            return { ...assets, categories: categories.categories ?? [] }
        },
    },
    "/finance/payables": {
        queryKey: ["finance", "ap-aging"] as const,
        queryFn: async () => {
            const { getAPAgingReport } = await import("@/lib/actions/finance")
            return await getAPAgingReport()
        },
    },
    // Companion queries for payables default tab (bills)
    "/finance/payables#bills": {
        queryKey: [...queryKeys.bills.list(), { q: null, status: null, page: 1, pageSize: 20 }],
        queryFn: async () => await getVendorBillsRegistry(),
    },
    "/finance/payables#banks": {
        queryKey: ["banks", "list"] as const,
        queryFn: async () => {
            const { getAvailableBanks } = await import("@/lib/actions/xendit")
            const data = await getAvailableBanks()
            return { banks: data.banks, ewallets: data.ewallets }
        },
    },
    // --- Pages previously missing from prefetch (audit 2026-03-27) ---
    "/finance/payments": {
        queryKey: queryKeys.arPayments.all,
        queryFn: async () => {
            const { getARPaymentRegistry, getARPaymentStats } = await import("@/lib/actions/finance-ar")
            const [registry, stats] = await Promise.all([
                getARPaymentRegistry({}),
                getARPaymentStats(),
            ])
            return { registry, stats }
        },
    },
    "/finance/fixed-assets/categories": {
        queryKey: queryKeys.fixedAssetCategories.list(),
        queryFn: async () => {
            const result = await getFixedAssetCategories()
            return result && "categories" in result ? result : { categories: [] }
        },
    },
    "/finance/fixed-assets/depreciation": {
        queryKey: queryKeys.depreciationRuns.list(),
        queryFn: async () => {
            const result = await getDepreciationRuns()
            return result && "runs" in result ? result : { runs: [] }
        },
    },
    "/finance/fixed-assets/reports": {
        queryKey: queryKeys.fixedAssetReports.register(),
        queryFn: async () => {
            const result = await getAssetRegisterReport()
            return result && "assets" in result ? result : { assets: [] }
        },
    },
    "/accountant/coa": {
        queryKey: queryKeys.glAccounts.list(),
        queryFn: async () => {
            const res = await getGLAccounts()
            return "data" in res && res.data ? res.data : []
        },
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
        queryFn: getUnits,
    },
    brands: {
        queryKey: queryKeys.brands.list(),
        queryFn: getBrands,
    },
    colors: {
        queryKey: queryKeys.colors.list(),
        queryFn: getColors,
    },
    masterCategories: {
        queryKey: queryKeys.categories.master(),
        queryFn: getMasterCategories,
    },
    suppliers: {
        queryKey: queryKeys.suppliers.list(),
        queryFn: getSuppliers,
    },
    uomConversions: {
        queryKey: queryKeys.uomConversions.list(),
        queryFn: getUomConversions,
    },
    glAccounts: {
        queryKey: queryKeys.glAccounts.list(),
        queryFn: getGLAccountsList,
    },
    bankAccounts: {
        queryKey: queryKeys.glAccounts.bankAccounts(),
        queryFn: async () => {
            const accounts = await getPettyCashBankAccounts()
            return accounts.filter((a: { code: string }) => /^10\d{2}$/.test(a.code))
        },
    },
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
        queryFn: async () => {
            const res = await fetch("/api/sidebar/action-counts")
            if (!res.ok) return null
            return res.json()
        },
    },
    paymentTerms: {
        queryKey: queryKeys.paymentTerms.list(),
        queryFn: getPaymentTerms,
    },
}

export function useNavPrefetch() {
    const router = useRouter()
    const queryClient = useQueryClient()

    const prefetchRoute = useCallback(
        (url: string) => {
            router.prefetch(url)

            const config = routePrefetchMap[url]
            if (config) {
                const tier = getTierForRoute(url)
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

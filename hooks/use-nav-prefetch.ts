"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getAllCategories, getCategories } from "@/app/actions/inventory"
import { getEmployees, getAttendanceSnapshot, getLeaveRequests } from "@/app/actions/hcm"
import { getQuotations, getAllPriceLists } from "@/lib/actions/sales"
import { getAllPurchaseOrders, getVendors, getPurchaseRequests, getPendingApprovalPOs } from "@/lib/actions/procurement"
import { getProductsForPO } from "@/app/actions/purchase-order"
import { getFabricRolls, getWarehousesForRolls, getFabricProducts } from "@/lib/actions/fabric-rolls"
import { getStockTransfers, getTransferFormData } from "@/lib/actions/stock-transfers"
import { getFinancialMetrics, getFinanceDashboardData, getJournalEntries, getGLAccountsList, getChartOfAccountsTree, getVendorPayments, getVendorBillsRegistry } from "@/lib/actions/finance"
import { getVendors as getVendorsList } from "@/app/actions/vendor"
import { getPendingPOsForReceiving, getAllGRNs, getWarehousesForGRN, getEmployeesForGRN } from "@/lib/actions/grn"
import { getSchedulableWorkOrders, getMachinesForScheduling, getRoutingsForScheduling } from "@/lib/actions/manufacturing-garment"
import { getStaffTasks, getManagerTasks, getDepartmentEmployees, getAssignableOrders, getManagerDashboardStats } from "@/lib/actions/tasks"
import { getSubcontractOrders, getSubcontractors, getProductsForSubcontract, getSubcontractDashboard } from "@/lib/actions/subcontract"
import { getCostingDashboard, getProductsForCostSheet, getCostSheets } from "@/lib/actions/costing"
import { getCuttingDashboard, getCutPlans, getFabricProducts as getCuttingFabricProducts } from "@/lib/actions/cutting"
import { getWeeklyShiftSchedule, getEmployeeShifts } from "@/lib/actions/hcm-shifts"
import { getOnboardingTemplates } from "@/lib/actions/hcm-onboarding"
import { getReconciliations, getBankAccounts } from "@/lib/actions/finance-reconciliation"
import { getDocumentSystemOverview } from "@/app/actions/documents-system"
import { getHCMDashboardData } from "@/app/actions/hcm"
import { getRecentAudits, getProductsForKanban, getWarehouses } from "@/app/actions/inventory"

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
        queryKey: queryKeys.bom.list(),
        queryFn: () => fetch("/api/manufacturing/bom").then((r) => r.json()).then((p) => (p.success ? p.data : [])),
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
        queryKey: ["fabricRolls", "list"],
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
        queryKey: ["stockTransfers", "list"],
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
        queryKey: ["receiving", "list"],
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
        queryKey: queryKeys.bills.list(),
        queryFn: async () => await getVendorBillsRegistry(),
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
        queryFn: () => fetch("/api/sales/page-data").then((r) => r.json()).then((p) => p.data),
    },
    "/staff": {
        queryKey: queryKeys.staffTasks.list(),
        queryFn: async () => await getStaffTasks(),
    },
    "/manager": {
        queryKey: queryKeys.managerDashboard.list(),
        queryFn: async () => {
            const tasks = await getManagerTasks()
            const employees = await getDepartmentEmployees()
            const orders = await getAssignableOrders()
            const dashboard = await getManagerDashboardStats()
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
    "/finance/reconciliation": {
        queryKey: queryKeys.reconciliation.list(),
        queryFn: async () => {
            const [reconciliations, bankAccounts] = await Promise.all([
                getReconciliations(),
                getBankAccounts(),
            ])
            return { reconciliations, bankAccounts }
        },
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
    "/inventory/audit": {
        queryKey: queryKeys.inventoryAudit.list(),
        queryFn: async () => {
            const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
                Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))])
            const [logs, prods, whs] = await Promise.all([
                withTimeout(getRecentAudits(), 8000, []),
                withTimeout(getProductsForKanban(), 8000, []),
                withTimeout(getWarehouses(), 5000, []),
            ])
            return { auditLogs: logs, products: prods, warehouses: whs }
        },
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
                queryClient.prefetchQuery({
                    queryKey: config.queryKey,
                    queryFn: config.queryFn,
                })
            }
        },
        [router, queryClient]
    )

    return { prefetchRoute }
}

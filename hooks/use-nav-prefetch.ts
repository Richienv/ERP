"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getAllCategories, getCategories } from "@/app/actions/inventory"
import { getEmployees } from "@/app/actions/hcm"
import { getQuotations } from "@/lib/actions/sales"
import { getAllPurchaseOrders, getVendors } from "@/lib/actions/procurement"
import { getProductsForPO } from "@/app/actions/purchase-order"
import { getFabricRolls, getWarehousesForRolls, getFabricProducts } from "@/lib/actions/fabric-rolls"
import { getStockTransfers, getTransferFormData } from "@/lib/actions/stock-transfers"
import { getFinancialMetrics, getFinanceDashboardData, getJournalEntries, getGLAccountsList, getChartOfAccountsTree, getVendorPayments, getVendorBillsRegistry } from "@/lib/actions/finance"
import { getPurchaseRequests } from "@/lib/actions/procurement"
import { getVendors as getVendorsList } from "@/app/actions/vendor"
import { getPendingPOsForReceiving, getAllGRNs, getWarehousesForGRN, getEmployeesForGRN } from "@/lib/actions/grn"
import { getSchedulableWorkOrders, getMachinesForScheduling, getRoutingsForScheduling } from "@/lib/actions/manufacturing-garment"

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

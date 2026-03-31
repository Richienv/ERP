"use client"

import { useRealtimeInvalidation } from "@/hooks/use-realtime-invalidation"
import { useAuth } from "@/lib/auth-context"
import { queryKeys } from "@/lib/query-keys"

/**
 * Invisible component that subscribes to Supabase Realtime for critical tables.
 * When a row is inserted/updated/deleted, the corresponding TanStack Query
 * caches are invalidated so mounted components refetch automatically.
 *
 * This allows higher staleTime (data stays cached longer) because Realtime
 * pushes changes instead of relying on polling or window-focus refetch.
 */
export function RealtimeProvider() {
    const { isAuthenticated } = useAuth()

    if (!isAuthenticated) return null

    return <RealtimeSubscriptions />
}

function RealtimeSubscriptions() {
    // Finance — invoices, payments, journal entries
    useRealtimeInvalidation("invoices", [
        queryKeys.invoices.all,
        ["finance", "ar-aging"],
        ["finance", "ap-aging"],
        queryKeys.financeDashboard.all,
        queryKeys.financeReports.all,
    ])

    useRealtimeInvalidation("journal_entries", [
        queryKeys.journal.all,
        queryKeys.chartAccounts.all,
        queryKeys.financeReports.all,
    ])

    useRealtimeInvalidation("payments", [
        queryKeys.arPayments.all,
        queryKeys.vendorPayments.all,
        queryKeys.invoices.all,
    ])

    // Sales — customers, orders
    useRealtimeInvalidation("customers", [
        queryKeys.customers.all,
        queryKeys.salesDashboard.all,
    ])

    useRealtimeInvalidation("sales_orders", [
        queryKeys.salesOrders.all,
        queryKeys.salesDashboard.all,
        queryKeys.salesPage.all,
    ])

    // Inventory — products, stock levels
    useRealtimeInvalidation("products", [
        queryKeys.products.all,
        queryKeys.inventoryDashboard.all,
    ])

    // Procurement — purchase orders
    useRealtimeInvalidation("purchase_orders", [
        queryKeys.purchaseOrders.all,
        queryKeys.procurementDashboard.all,
        queryKeys.approvals.all,
    ])

    return null
}

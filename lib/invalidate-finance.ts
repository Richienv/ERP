import { QueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function invalidateFinanceQueries(queryClient: QueryClient) {
    queryClient.invalidateQueries({ queryKey: ["finance", "ar-aging"] })
    queryClient.invalidateQueries({ queryKey: ["finance", "ap-aging"] })
    queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all })
}

export function invalidateProcurementQueries(queryClient: QueryClient) {
    queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all })
}

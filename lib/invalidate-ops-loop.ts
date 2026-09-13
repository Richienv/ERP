import type { QueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

/**
 * After money or an approval moves, refresh the CEO inbox and dashboards.
 * Call this in addition to the page's own query keys.
 */
export function invalidateOpsLoop(queryClient: QueryClient) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.miningCommand.pulse() })
    void queryClient.invalidateQueries({ queryKey: queryKeys.executiveDashboard.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
}

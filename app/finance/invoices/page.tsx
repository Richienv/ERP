import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getInvoiceKanbanData } from "@/lib/actions/finance-invoices"
import { InvoicesPageClient } from "./invoices-client"

export const dynamic = "force-dynamic"

export default async function InvoicesPage() {
    const queryClient = new QueryClient()

    await queryClient.prefetchQuery({
        queryKey: queryKeys.invoices.kanban(),
        queryFn: async () => {
            const data = await getInvoiceKanbanData({ q: null, type: "ALL" })
            return data ?? { draft: [], sent: [], overdue: [], paid: [] }
        },
    })

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <InvoicesPageClient />
        </HydrationBoundary>
    )
}

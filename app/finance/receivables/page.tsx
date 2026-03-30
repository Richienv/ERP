import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query"
import { getARAgingReport } from "@/lib/actions/finance"
import { ReceivablesPageClient } from "./receivables-client"

export const dynamic = "force-dynamic"

export default async function ReceivablesPage() {
    const queryClient = new QueryClient()

    await queryClient.prefetchQuery({
        queryKey: ["finance", "ar-aging"],
        queryFn: () => getARAgingReport(),
    })

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ReceivablesPageClient />
        </HydrationBoundary>
    )
}

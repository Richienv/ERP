import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query"
import { getAPAgingReport } from "@/lib/actions/finance"
import { PayablesPageClient } from "./payables-client"

export const dynamic = "force-dynamic"

export default async function PayablesPage() {
    const queryClient = new QueryClient()

    await queryClient.prefetchQuery({
        queryKey: ["finance", "ap-aging"],
        queryFn: () => getAPAgingReport(),
    })

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <PayablesPageClient />
        </HydrationBoundary>
    )
}

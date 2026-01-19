import { getLatestSnapshot } from "@/app/actions/dashboard"
import { FinanceSnapshot } from "@/components/dashboard/finance-snapshot"

export async function FinanceWrapper() {
    // Artificial delay to demonstrate streaming if needed (optional, remove in prod)
    // await new Promise(resolve => setTimeout(resolve, 0)) 

    const snapshot = await getLatestSnapshot()

    return <FinanceSnapshot data={snapshot} />
}

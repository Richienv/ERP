import { getPendingApprovalPOs } from "@/lib/actions/procurement"
import { ApprovalsView } from "./approvals-view"

// Force dynamic rendering for real-time updates
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ApprovalsPage() {
    const pendingPOs = await getPendingApprovalPOs()

    return <ApprovalsView pendingPOs={pendingPOs} />
}

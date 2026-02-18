"use client"

import { useApprovals } from "@/hooks/use-approvals"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { ApprovalsView } from "./approvals-view"

export default function ApprovalsPage() {
    const { data, isLoading } = useApprovals()

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-red-400" />

    return <ApprovalsView pendingPOs={data.pendingPOs} />
}

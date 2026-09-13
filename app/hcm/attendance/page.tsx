"use client"

import { useSearchParams } from "next/navigation"
import { useAttendance } from "@/hooks/use-attendance"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { InlinePendingBar } from "@/components/ui/inline-pending"
import { AttendanceClient } from "./attendance-client"

export default function AttendancePage() {
    const { data, isFetching } = useAttendance()
    const searchParams = useSearchParams()

    if (!data) return <TablePageSkeleton accentColor="bg-orange-400" />

    return (
        <div className="relative min-h-screen bg-background p-4 md:p-8 pb-24">
            <InlinePendingBar active={isFetching} />
            <AttendanceClient
                initialTab={searchParams.get("tab") ?? undefined}
                initialSnapshot={data.initialSnapshot}
                initialEmployees={data.initialEmployees}
                initialLeaveRequests={data.initialLeaveRequests}
            />
        </div>
    )
}

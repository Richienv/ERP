"use client"

import { useAttendance } from "@/hooks/use-attendance"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { AttendanceClient } from "./attendance-client"

export default function AttendancePage() {
    const { data, isLoading } = useAttendance()

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-teal-400" />

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 pb-24">
            <AttendanceClient
                initialSnapshot={data.initialSnapshot}
                initialEmployees={data.initialEmployees}
                initialLeaveRequests={data.initialLeaveRequests}
            />
        </div>
    )
}

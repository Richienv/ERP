"use client"

import { useEmployees } from "@/hooks/use-employees"
import { EmployeeMasterClient } from "./employee-master-client"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { InlinePendingBar } from "@/components/ui/inline-pending"

export default function EmployeeMasterPage() {
    const { data, isFetching } = useEmployees()

    if (!data) {
        return (
            <div className="min-h-screen bg-background p-4 md:p-8 pb-24">
                <TablePageSkeleton accentColor="bg-orange-400" />
            </div>
        )
    }

    return (
        <div className="relative min-h-screen bg-background p-4 md:p-8 pb-24">
            <InlinePendingBar active={isFetching} />
            <EmployeeMasterClient initialEmployees={data} />
        </div>
    )
}

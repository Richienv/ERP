"use client"

import { useEmployees } from "@/hooks/use-employees"
import { EmployeeMasterClient } from "./employee-master-client"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export default function EmployeeMasterPage() {
    const { data, isLoading } = useEmployees()

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background p-4 md:p-8 pb-24">
                <TablePageSkeleton accentColor="bg-violet-400" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 pb-24">
            <EmployeeMasterClient initialEmployees={data ?? []} />
        </div>
    )
}

"use client"

import { useStaffTasks } from "@/hooks/use-staff-tasks"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { StaffTasksClient } from "./staff-tasks-client"
import { AlertTriangle } from "lucide-react"

export default function StaffPage() {
    const { data, isLoading } = useStaffTasks()

    if (isLoading) return <TablePageSkeleton accentColor="bg-amber-400" />

    if (!data) {
        return (
            <div className="min-h-screen bg-background p-4 md:p-6 pb-24">
                <div className="bg-white border border-border shadow-sm p-8 text-center">
                    <AlertTriangle className="h-8 w-8 mx-auto text-amber-400 mb-3" />
                    <h2 className="text-sm font-semibold mb-1">
                        Profil Belum Terhubung
                    </h2>
                    <p className="text-xs font-bold text-zinc-500">
                        Akun Anda belum terhubung ke profil karyawan. Hubungi admin SDM.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background p-4 md:p-6 pb-24">
            <StaffTasksClient tasks={data.tasks} employee={data.employee} />
        </div>
    )
}

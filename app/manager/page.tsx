"use client"

import { useManagerDashboard } from "@/hooks/use-manager-dashboard"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { ManagerPageClient } from "./manager-page-client"
import { AlertTriangle } from "lucide-react"

export default function ManagerPage() {
    const { data, isLoading, isError } = useManagerDashboard()

    if (isLoading) return <TablePageSkeleton accentColor="bg-indigo-400" />

    if (isError || !data) {
        return (
            <div className="min-h-screen bg-background p-4 md:p-8 space-y-8 pb-24 font-sans">
                <div className="bg-white border border-border shadow-sm p-8 text-center">
                    <AlertTriangle className="h-8 w-8 mx-auto text-amber-400 mb-3" />
                    <h2 className="text-sm font-semibold mb-1">
                        Akses Ditolak
                    </h2>
                    <p className="text-xs font-bold text-zinc-500">
                        Anda tidak memiliki akses ke halaman manajer. Hubungi admin.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 space-y-8 pb-24 font-sans">
            <ManagerPageClient
                tasks={data.tasks}
                employees={data.employees}
                orders={data.orders}
                dashboard={data.dashboard}
            />
        </div>
    )
}

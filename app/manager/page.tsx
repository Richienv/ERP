import { Suspense } from "react"
import { getManagerTasks, getDepartmentEmployees, getAssignableOrders, getManagerDashboardStats } from "@/lib/actions/tasks"
import { ManagerPageClient } from "./manager-page-client"
import { Factory, AlertTriangle } from "lucide-react"

export const dynamic = "force-dynamic"

async function ManagerContent() {
    try {
        // Sequential to avoid exhausting Supabase session-mode connection pool
        const tasks = await getManagerTasks()
        const employees = await getDepartmentEmployees()
        const orders = await getAssignableOrders()
        const dashboard = await getManagerDashboardStats()

        return (
            <ManagerPageClient
                tasks={tasks}
                employees={employees}
                orders={orders}
                dashboard={dashboard}
            />
        )
    } catch {
        return (
            <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-8 text-center">
                <AlertTriangle className="h-8 w-8 mx-auto text-amber-400 mb-3" />
                <h2 className="text-sm font-black uppercase tracking-widest mb-1">
                    Akses Ditolak
                </h2>
                <p className="text-[10px] font-bold text-zinc-500">
                    Anda tidak memiliki akses ke halaman manajer. Hubungi admin.
                </p>
            </div>
        )
    }
}

export default function ManagerPage() {
    return (
        <div className="min-h-screen bg-background p-4 md:p-8 space-y-8 pb-24 font-sans">
            <Suspense
                fallback={
                    <div className="flex items-center gap-2 text-zinc-400 pt-8">
                        <Factory className="h-5 w-5 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Memuat dashboard...
                        </span>
                    </div>
                }
            >
                <ManagerContent />
            </Suspense>
        </div>
    )
}

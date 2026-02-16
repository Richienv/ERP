import { Suspense } from "react"
import { getStaffTasks } from "@/lib/actions/tasks"
import { StaffTasksClient } from "./staff-tasks-client"
import { ClipboardCheck, AlertTriangle } from "lucide-react"

export const dynamic = "force-dynamic"

async function StaffContent() {
    const data = await getStaffTasks()

    if (!data) {
        return (
            <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-8 text-center">
                <AlertTriangle className="h-8 w-8 mx-auto text-amber-400 mb-3" />
                <h2 className="text-sm font-black uppercase tracking-widest mb-1">
                    Profil Belum Terhubung
                </h2>
                <p className="text-[10px] font-bold text-zinc-500">
                    Akun Anda belum terhubung ke profil karyawan. Hubungi admin SDM.
                </p>
            </div>
        )
    }

    return <StaffTasksClient tasks={data.tasks} employee={data.employee} />
}

export default function StaffPage() {
    return (
        <div className="min-h-screen bg-background p-4 md:p-6 pb-24">
            <Suspense
                fallback={
                    <div className="flex items-center gap-2 text-zinc-400 pt-8">
                        <ClipboardCheck className="h-5 w-5 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Memuat tugas...
                        </span>
                    </div>
                }
            >
                <StaffContent />
            </Suspense>
        </div>
    )
}

import { Suspense } from "react"
import {
    getAttendanceSnapshot,
    getEmployees,
    getLeaveRequests,
} from "@/app/actions/hcm"
import { AttendanceClient } from "./attendance-client"
import { ClipboardList } from "lucide-react"

export const dynamic = "force-dynamic"

async function AttendanceContent() {
    const today = new Date().toISOString().slice(0, 10)

    // Sequential to avoid exhausting Supabase session-mode pool
    const snapshot = await getAttendanceSnapshot({ date: today })
    const employees = await getEmployees({ includeInactive: false })
    const leaveRequests = await getLeaveRequests({ status: "ALL", limit: 30 })

    return (
        <AttendanceClient
            initialSnapshot={snapshot}
            initialEmployees={employees as any[]}
            initialLeaveRequests={leaveRequests as any[]}
        />
    )
}

export default function AttendancePage() {
    return (
        <div className="min-h-screen bg-background p-4 md:p-8 pb-24">
            <Suspense
                fallback={
                    <div className="flex items-center gap-2 text-zinc-400 pt-8">
                        <ClipboardList className="h-5 w-5 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Memuat data absensi...
                        </span>
                    </div>
                }
            >
                <AttendanceContent />
            </Suspense>
        </div>
    )
}

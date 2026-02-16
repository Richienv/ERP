import { Suspense } from "react"
import { getEmployees } from "@/app/actions/hcm"
import { EmployeeMasterClient } from "./employee-master-client"
import { Users } from "lucide-react"

export const dynamic = "force-dynamic"

async function EmployeeContent() {
    const employees = await getEmployees({ includeInactive: true })

    return <EmployeeMasterClient initialEmployees={employees as any[]} />
}

export default function EmployeeMasterPage() {
    return (
        <div className="min-h-screen bg-background p-4 md:p-8 pb-24">
            <Suspense
                fallback={
                    <div className="flex items-center gap-2 text-zinc-400 pt-8">
                        <Users className="h-5 w-5 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Memuat data karyawan...
                        </span>
                    </div>
                }
            >
                <EmployeeContent />
            </Suspense>
        </div>
    )
}

import { Suspense } from "react"
import { getSubcontractors } from "@/lib/actions/subcontract"
import { SubcontractorList } from "@/components/subcontract/subcontractor-list"
import { Factory } from "lucide-react"

export const dynamic = "force-dynamic"

async function RegistryContent() {
    const subcontractors = await getSubcontractors()
    return <SubcontractorList subcontractors={subcontractors} />
}

export default function SubcontractRegistryPage() {
    return (
        <div className="p-6 space-y-6">
            <Suspense
                fallback={
                    <div className="flex items-center gap-2 text-zinc-400">
                        <Factory className="h-5 w-5 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Memuat registri...
                        </span>
                    </div>
                }
            >
                <RegistryContent />
            </Suspense>
        </div>
    )
}

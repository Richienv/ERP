import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getCostSheetDetail } from "@/lib/actions/costing"
import { SheetDetailClient } from "./sheet-detail-client"
import { DollarSign } from "lucide-react"

export const dynamic = "force-dynamic"

interface Props {
    params: Promise<{ id: string }>
}

async function DetailContent({ id }: { id: string }) {
    const sheet = await getCostSheetDetail(id)
    if (!sheet) notFound()

    return <SheetDetailClient sheet={sheet} />
}

export default async function CostSheetDetailPage({ params }: Props) {
    const { id } = await params

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 pb-24">
            <Suspense
                fallback={
                    <div className="flex items-center gap-2 text-zinc-400 pt-8">
                        <DollarSign className="h-5 w-5 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Memuat detail cost sheet...
                        </span>
                    </div>
                }
            >
                <DetailContent id={id} />
            </Suspense>
        </div>
    )
}

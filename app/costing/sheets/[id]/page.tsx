"use client"

import { useParams } from "next/navigation"
import { useCostSheetDetail } from "@/hooks/use-cost-sheet-detail"
import { SheetDetailClient } from "./sheet-detail-client"
import { DollarSign } from "lucide-react"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"

export default function CostSheetDetailPage() {
    const { id } = useParams<{ id: string }>()
    const { data: sheet, isLoading } = useCostSheetDetail(id)

    if (isLoading || !sheet) {
        return <CardPageSkeleton accentColor="bg-rose-400" />
    }

    return (
        <div className="mf-page pb-24">
            <SheetDetailClient sheet={sheet} />
        </div>
    )
}

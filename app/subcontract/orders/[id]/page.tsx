"use client"

import { useParams } from "next/navigation"
import { useSubcontractOrderDetail } from "@/hooks/use-subcontract-order-detail"
import { SubcontractOrderDetailView } from "@/components/subcontract/subcontract-order-detail"
import { ArrowLeft, ClipboardList } from "lucide-react"
import Link from "next/link"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"

export default function SubcontractOrderDetailPage() {
    const { id } = useParams<{ id: string }>()
    const { data, isLoading } = useSubcontractOrderDetail(id)

    if (isLoading || !data || !data.order) {
        return <CardPageSkeleton accentColor="bg-orange-400" />
    }

    return (
        <div className="mf-page">
            <div className="flex items-center gap-3">
                <Link
                    href="/subcontract/orders"
                    className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-zinc-500 hover:text-black transition-colors"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Kembali
                </Link>
                <div className="w-px h-4 bg-zinc-300" />
                <div className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    <h1 className="text-sm font-black uppercase tracking-widest">
                        Detail Order Subkontrak
                    </h1>
                </div>
            </div>

            <SubcontractOrderDetailView order={data.order} warehouses={data.warehouses} />
        </div>
    )
}

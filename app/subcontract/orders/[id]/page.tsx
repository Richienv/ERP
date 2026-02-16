import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getSubcontractOrderDetail, getWarehousesForSubcontract } from "@/lib/actions/subcontract"
import { SubcontractOrderDetailView } from "@/components/subcontract/subcontract-order-detail"
import { ArrowLeft, ClipboardList } from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic"

async function OrderDetailContent({ id }: { id: string }) {
    const [order, warehouses] = await Promise.all([
        getSubcontractOrderDetail(id),
        getWarehousesForSubcontract(),
    ])

    if (!order) notFound()

    return <SubcontractOrderDetailView order={order} warehouses={warehouses} />
}

export default async function SubcontractOrderDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params

    return (
        <div className="p-6 space-y-6">
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

            <Suspense
                fallback={
                    <div className="flex items-center gap-2 text-zinc-400">
                        <ClipboardList className="h-5 w-5 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Memuat detail order...
                        </span>
                    </div>
                }
            >
                <OrderDetailContent id={id} />
            </Suspense>
        </div>
    )
}

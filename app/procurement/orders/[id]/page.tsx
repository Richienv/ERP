"use client"
import { use } from "react"
import { usePurchaseOrderDetail } from "@/hooks/use-purchase-order-detail"
import { DetailPage } from "@/components/integra/detail-page"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export default function PoDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const { data, isLoading, error } = usePurchaseOrderDetail(id)

    if (isLoading) return <TablePageSkeleton accentColor="bg-blue-400" />

    if (error) {
        return (
            <div className="px-6 py-12 text-center">
                <h1 className="font-display text-[20px] text-[var(--integra-red)]">Terjadi kesalahan</h1>
                <p className="text-[12.5px] text-[var(--integra-muted)] mt-2">{error.message}</p>
            </div>
        )
    }

    if (!data) {
        return (
            <div className="px-6 py-12 text-center">
                <h1 className="font-display text-[20px]">PO tidak ditemukan</h1>
            </div>
        )
    }

    const totalJt = (Number(data.totalAmount ?? 0) / 1_000_000).toFixed(1).replace(".", ",")
    const itemCount = data.items?.length ?? 0
    const supplierName = data.supplier?.name ?? "Unknown"

    return (
        <DetailPage
            breadcrumb={[
                { label: "Beranda", href: "/dashboard" },
                { label: "Pengadaan", href: "/procurement" },
                { label: "Pesanan Pembelian", href: "/procurement/orders" },
            ]}
            title={data.number}
            subtitle={`${supplierName} · ${itemCount} item · Total Rp ${totalJt} jt`}
            tabs={[
                {
                    key: "header",
                    label: "Header",
                    content: (
                        <div className="text-[12.5px] text-[var(--integra-muted)]">
                            Header tab content — Phase C2
                        </div>
                    ),
                },
                {
                    key: "item",
                    label: `Item (${itemCount})`,
                    content: (
                        <div className="text-[12.5px] text-[var(--integra-muted)]">
                            Item tab — Phase C3
                        </div>
                    ),
                },
                {
                    key: "approval",
                    label: "Approval",
                    content: (
                        <div className="text-[12.5px] text-[var(--integra-muted)]">
                            Approval tab — Phase C4
                        </div>
                    ),
                },
                {
                    key: "history",
                    label: "History",
                    content: (
                        <div className="text-[12.5px] text-[var(--integra-muted)]">
                            History tab — Phase C5
                        </div>
                    ),
                },
                {
                    key: "lampiran",
                    label: "Lampiran",
                    content: (
                        <div className="text-[12.5px] text-[var(--integra-muted)]">
                            Lampiran tab — Phase C6
                        </div>
                    ),
                },
                {
                    key: "komunikasi",
                    label: "Komunikasi",
                    content: (
                        <div className="text-[12.5px] text-[var(--integra-muted)]">
                            Komunikasi tab — Phase C6
                        </div>
                    ),
                },
            ]}
            defaultTab="header"
        />
    )
}

"use client"
import { use } from "react"
import { IconPrinter } from "@tabler/icons-react"
import { usePurchaseOrderDetail } from "@/hooks/use-purchase-order-detail"
import { DetailPage } from "@/components/integra/detail-page"
import { DetailPageSkeleton } from "@/components/integra/detail-page-skeleton"
import { TypstPdfButton } from "@/components/integra/typst-pdf-button"
import { HeaderTab } from "./_tabs/header-tab"
import { ItemTab } from "./_tabs/item-tab"
import { ApprovalTab } from "./_tabs/approval-tab"
import { HistoryTab } from "./_tabs/history-tab"
import { LampiranTab } from "./_tabs/lampiran-tab"
import { KomunikasiTab } from "./_tabs/komunikasi-tab"

export default function PoDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const { data, isLoading, error } = usePurchaseOrderDetail(id)

    if (isLoading) return <DetailPageSkeleton />

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
            actions={
                <TypstPdfButton
                    endpoint={`/api/procurement/orders/${data.id}/pdf`}
                    filename={`${data.number}.pdf`}
                    label="Print PDF"
                    icon={<IconPrinter className="size-3.5" />}
                />
            }
            tabs={[
                {
                    key: "header",
                    label: "Header",
                    content: <HeaderTab data={data} />,
                },
                {
                    key: "item",
                    label: `Item (${itemCount})`,
                    content: <ItemTab data={data} />,
                },
                {
                    key: "approval",
                    label: "Approval",
                    content: <ApprovalTab data={data} />,
                },
                {
                    key: "history",
                    label: "History",
                    content: <HistoryTab data={data} />,
                },
                {
                    key: "lampiran",
                    label: "Lampiran",
                    content: <LampiranTab data={data} />,
                },
                {
                    key: "komunikasi",
                    label: "Komunikasi",
                    content: <KomunikasiTab data={data} />,
                },
            ]}
            defaultTab="header"
        />
    )
}

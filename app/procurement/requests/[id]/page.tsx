"use client"
import { use } from "react"
import Link from "next/link"
import { usePurchaseRequestDetail } from "@/hooks/use-purchase-request-detail"
import { DetailPage } from "@/components/integra/detail-page"
import { DetailPageSkeleton } from "@/components/integra/detail-page-skeleton"
import { EmptyState } from "@/components/integra"
import { HeaderTab } from "./_tabs/header-tab"
import { ItemTab } from "./_tabs/item-tab"
import { ApprovalTab } from "./_tabs/approval-tab"
import { HistoryTab } from "./_tabs/history-tab"
import { LampiranTab } from "./_tabs/lampiran-tab"
import { KomunikasiTab } from "./_tabs/komunikasi-tab"

export default function PrDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const { data, isLoading, error, refetch } = usePurchaseRequestDetail(id)

    if (isLoading) return <DetailPageSkeleton />

    if (error) {
        return (
            <div className="px-6 py-12">
                <EmptyState
                    title="Gagal memuat detail PR"
                    description={
                        error instanceof Error
                            ? error.message
                            : "Terjadi kesalahan saat memuat detail Permintaan Pembelian. Silakan coba lagi."
                    }
                    action={
                        <div className="flex gap-2 justify-center">
                            <button
                                type="button"
                                onClick={() => refetch()}
                                className="h-8 px-4 bg-[var(--integra-ink)] text-[var(--integra-canvas)] text-[12px] rounded-[3px]"
                            >
                                Coba lagi
                            </button>
                            <Link
                                href="/procurement/requests"
                                className="h-8 px-4 border border-[var(--integra-hairline-strong)] text-[12px] rounded-[3px] flex items-center"
                            >
                                Kembali ke daftar
                            </Link>
                        </div>
                    }
                />
            </div>
        )
    }

    if (!data) {
        return (
            <div className="px-6 py-12">
                <EmptyState
                    title="PR tidak ditemukan"
                    description="PR yang kamu cari mungkin sudah dihapus atau ID-nya salah."
                    action={
                        <Link
                            href="/procurement/requests"
                            className="h-8 px-4 bg-[var(--integra-ink)] text-[var(--integra-canvas)] text-[12px] rounded-[3px] inline-flex items-center"
                        >
                            Kembali ke daftar PR
                        </Link>
                    }
                />
            </div>
        )
    }

    const itemCount = data.items?.length ?? 0
    const requesterName = data.requester
        ? `${data.requester.firstName ?? ""} ${data.requester.lastName ?? ""}`.trim() || "—"
        : "—"
    const department = data.department || data.requester?.department || "—"
    const estimatedLabel =
        data.estimatedTotal === null || data.estimatedTotal === undefined
            ? "Estimasi: —"
            : `Estimasi Rp ${(Number(data.estimatedTotal) / 1_000_000).toFixed(1).replace(".", ",")} jt`

    return (
        <DetailPage
            breadcrumb={[
                { label: "Beranda", href: "/dashboard" },
                { label: "Pengadaan", href: "/procurement" },
                { label: "Permintaan Pembelian", href: "/procurement/requests" },
            ]}
            title={data.number}
            subtitle={`${requesterName} · ${department} · ${itemCount} item · ${estimatedLabel}`}
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

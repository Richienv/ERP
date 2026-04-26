"use client"
import { use } from "react"
import Link from "next/link"
import { IconPrinter } from "@tabler/icons-react"
import { useGRNDetail } from "@/hooks/use-grn-detail"
import { DetailPage } from "@/components/integra/detail-page"
import { DetailPageSkeleton } from "@/components/integra/detail-page-skeleton"
import { TypstPdfButton } from "@/components/integra/typst-pdf-button"
import { EmptyState, StatusPill } from "@/components/integra"
import { HeaderTab } from "./_tabs/header-tab"
import { ItemTab } from "./_tabs/item-tab"
import { InspeksiTab } from "./_tabs/inspeksi-tab"
import { HistoryTab } from "./_tabs/history-tab"
import { LampiranTab } from "./_tabs/lampiran-tab"
import { CatatanTab } from "./_tabs/catatan-tab"

function statusKind(s: string): "ok" | "warn" | "err" | "info" | "neutral" {
    const m: Record<string, "ok" | "warn" | "err" | "info" | "neutral"> = {
        DRAFT: "neutral",
        INSPECTING: "warn",
        PARTIAL_ACCEPTED: "ok",
        ACCEPTED: "ok",
        REJECTED: "err",
    }
    return m[s] ?? "neutral"
}

function statusLabel(s: string): string {
    const m: Record<string, string> = {
        DRAFT: "Draft",
        INSPECTING: "Inspeksi",
        PARTIAL_ACCEPTED: "Diterima Sebagian",
        ACCEPTED: "Diterima",
        REJECTED: "Ditolak",
    }
    return m[s] ?? s
}

export default function GRNDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const { data, isLoading, error, refetch } = useGRNDetail(id)

    if (isLoading) return <DetailPageSkeleton />

    if (error) {
        return (
            <div className="px-6 py-12">
                <EmptyState
                    title="Gagal memuat detail GRN"
                    description={
                        error.message ??
                        "Terjadi kesalahan saat memuat detail Surat Jalan Masuk. Silakan coba lagi."
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
                                href="/procurement/receiving"
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
                    title="GRN tidak ditemukan"
                    description="GRN yang kamu cari mungkin sudah dihapus atau ID-nya salah."
                    action={
                        <Link
                            href="/procurement/receiving"
                            className="h-8 px-4 bg-[var(--integra-ink)] text-[var(--integra-canvas)] text-[12px] rounded-[3px] inline-flex items-center"
                        >
                            Kembali ke daftar GRN
                        </Link>
                    }
                />
            </div>
        )
    }

    const totals = data.totals ?? { items: 0, quantityAccepted: 0, quantityRejected: 0 }
    const supplierName = data.purchaseOrder?.supplier?.name ?? "—"
    const itemCount = totals.items ?? 0
    const defectCount = data.items?.filter((i: any) => i.quantityRejected > 0).length ?? 0

    return (
        <DetailPage
            breadcrumb={[
                { label: "Beranda", href: "/dashboard" },
                { label: "Pengadaan", href: "/procurement" },
                { label: "Surat Jalan Masuk", href: "/procurement/receiving" },
            ]}
            title={data.number}
            subtitle={`${supplierName} · ${itemCount} item · ${totals.quantityAccepted} OK${
                totals.quantityRejected > 0 ? ` · ${totals.quantityRejected} ditolak` : ""
            }`}
            status={<StatusPill kind={statusKind(data.status)}>{statusLabel(data.status)}</StatusPill>}
            actions={
                <TypstPdfButton
                    endpoint={`/api/documents/surat-jalan-masuk/${data.id}`}
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
                    key: "inspeksi",
                    label: defectCount > 0 ? `Inspeksi (${defectCount})` : "Inspeksi",
                    content: <InspeksiTab data={data} />,
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
                    key: "catatan",
                    label: "Catatan",
                    content: <CatatanTab data={data} />,
                },
            ]}
            defaultTab="header"
        />
    )
}

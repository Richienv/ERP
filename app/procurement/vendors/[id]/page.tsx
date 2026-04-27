"use client"

import { use } from "react"
import Link from "next/link"
import { useVendorDetail } from "@/hooks/use-vendor-detail"
import { DetailPage } from "@/components/integra/detail-page"
import { DetailPageSkeleton } from "@/components/integra/detail-page-skeleton"
import { EmptyState, StatusPill } from "@/components/integra"
import { ProfilTab } from "./_tabs/profil-tab"
import { ProdukTab } from "./_tabs/produk-tab"
import { RiwayatPoTab } from "./_tabs/riwayat-po-tab"
import { PerformaTab } from "./_tabs/performa-tab"
import { PembayaranTab } from "./_tabs/pembayaran-tab"
import { CatatanTab } from "./_tabs/catatan-tab"

export default function VendorDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params)
    const { data, isLoading, error, refetch } = useVendorDetail(id)

    if (isLoading) return <DetailPageSkeleton />

    if (error) {
        return (
            <div className="px-6 py-12">
                <EmptyState
                    title="Gagal memuat detail vendor"
                    description={
                        error.message ??
                        "Terjadi kesalahan saat memuat detail pemasok. Silakan coba lagi."
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
                                href="/procurement/vendors"
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
                    title="Vendor tidak ditemukan"
                    description="Vendor yang kamu cari mungkin sudah dihapus atau ID-nya salah."
                    action={
                        <Link
                            href="/procurement/vendors"
                            className="h-8 px-4 bg-[var(--integra-ink)] text-[var(--integra-canvas)] text-[12px] rounded-[3px] inline-flex items-center"
                        >
                            Kembali ke daftar Pemasok
                        </Link>
                    }
                />
            </div>
        )
    }

    const productCount = data.supplierProducts?.length ?? 0
    const poCount = data.metrics?.poTotalCount ?? 0
    const billCount = data.invoices?.length ?? 0
    const paymentCount = data.payments?.length ?? 0
    const totalSpendJt = (data.metrics.totalSpend / 1_000_000).toFixed(1).replace(".", ",")

    return (
        <DetailPage
            breadcrumb={[
                { label: "Beranda", href: "/dashboard" },
                { label: "Pengadaan", href: "/procurement" },
                { label: "Pemasok", href: "/procurement/vendors" },
            ]}
            title={data.name}
            subtitle={`${data.code} · ${poCount} PO total · Belanja Rp ${totalSpendJt} jt`}
            status={
                data.isActive ? (
                    <StatusPill kind="ok">Aktif</StatusPill>
                ) : (
                    <StatusPill kind="neutral">Nonaktif</StatusPill>
                )
            }
            tabs={[
                {
                    key: "profil",
                    label: "Profil",
                    content: <ProfilTab data={data} />,
                },
                {
                    key: "produk",
                    label: `Produk (${productCount})`,
                    content: <ProdukTab data={data} />,
                },
                {
                    key: "riwayat",
                    label: `Riwayat PO (${poCount})`,
                    content: <RiwayatPoTab data={data} />,
                },
                {
                    key: "performa",
                    label: "Performa",
                    content: <PerformaTab data={data} />,
                },
                {
                    key: "pembayaran",
                    label: `Pembayaran (${billCount + paymentCount})`,
                    content: <PembayaranTab data={data} />,
                },
                {
                    key: "catatan",
                    label: "Catatan",
                    content: <CatatanTab data={data} />,
                },
            ]}
            defaultTab="profil"
        />
    )
}

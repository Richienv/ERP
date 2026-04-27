"use client"

import Link from "next/link"
import { DataTable, EmptyState, StatusPill, type ColumnDef } from "@/components/integra"
import { fmtIDR } from "@/lib/integra-tokens"
import type { VendorDetailPayload } from "@/hooks/use-vendor-detail"

type ProductRow = VendorDetailPayload["supplierProducts"][number]

export function ProdukTab({ data }: { data: VendorDetailPayload }) {
    const rows = data.supplierProducts ?? []

    if (rows.length === 0) {
        return (
            <EmptyState
                title="Belum ada produk yang dipasok"
                description="Vendor ini belum dikaitkan ke produk apapun di sistem. Tambahkan produk ke vendor melalui modul Inventaris."
            />
        )
    }

    const cols: ColumnDef<ProductRow>[] = [
        {
            key: "preferred",
            header: "★",
            render: (r) =>
                r.isPreferred ? (
                    <span className="text-[var(--integra-amber)] text-[14px]">★</span>
                ) : (
                    <span className="text-[var(--integra-muted)]">—</span>
                ),
            width: "32px",
        },
        {
            key: "code",
            header: "Kode Produk",
            type: "code",
            render: (r) =>
                r.product ? (
                    <Link
                        href={`/inventory/products/${r.product.id}`}
                        className="font-mono text-[11.5px] text-[var(--integra-liren-blue)] hover:underline"
                    >
                        {r.product.code}
                    </Link>
                ) : (
                    <span className="text-[var(--integra-muted)]">—</span>
                ),
            width: "120px",
        },
        {
            key: "name",
            header: "Nama Produk",
            type: "primary",
            render: (r) => r.product?.name ?? "—",
        },
        {
            key: "sku",
            header: "SKU Vendor",
            render: (r) => (
                <span className="font-mono text-[11.5px] text-[var(--integra-muted)]">
                    {r.skuCode ?? "—"}
                </span>
            ),
        },
        {
            key: "price",
            header: "Harga (Rp)",
            type: "num",
            render: (r) => (
                <span>
                    {fmtIDR(r.price)}
                    {r.currency !== "IDR" ? (
                        <span className="text-[10.5px] text-[var(--integra-muted)] ml-1">
                            {r.currency}
                        </span>
                    ) : null}
                </span>
            ),
        },
        {
            key: "moq",
            header: "MOQ",
            type: "num",
            render: (r) => (
                <span>
                    {r.minOrderQty}
                    {r.product?.unit ? (
                        <span className="text-[10.5px] text-[var(--integra-muted)] ml-1">
                            {r.product.unit}
                        </span>
                    ) : null}
                </span>
            ),
        },
        {
            key: "lt",
            header: "Lead Time",
            type: "num",
            render: (r) => `${r.leadTime} hari`,
        },
        {
            key: "status",
            header: "Status",
            render: (r) =>
                r.isPreferred ? (
                    <StatusPill kind="ok">Preferred</StatusPill>
                ) : (
                    <StatusPill kind="neutral">Standar</StatusPill>
                ),
        },
    ]

    return (
        <div className="space-y-3">
            <div className="text-[11.5px] text-[var(--integra-muted)]">
                Menampilkan {rows.length} produk yang dipasok oleh vendor ini.
            </div>
            <DataTable<ProductRow>
                columns={cols}
                rows={rows}
                rowKey={(r) => r.id}
            />
        </div>
    )
}

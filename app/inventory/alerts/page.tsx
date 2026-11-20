"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
    AlertTriangle,
    Search,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    ShieldAlert,
    ShoppingBag,
    TrendingDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useProductsPage } from "@/hooks/use-products-query";
import { TablePageSkeleton } from "@/components/ui/page-skeleton";
import { PurchaseRequestDialog } from "@/components/inventory/purchase-request-dialog";
import { NB } from "@/lib/dialog-styles";

const PAGE_SIZE = 10;

function toPrItem(product: any) {
    const gap = Math.max(0, (product.minStock ?? 0) - (product.currentStock ?? 0));
    return {
        id: product.id,
        name: product.name,
        sku: product.code ?? "",
        category: product.category?.name ?? "",
        unit: product.unit || "PCS",
        cost: Number(product.costPrice ?? 0),
        gap,
        reorderPoint: Number(product.minStock ?? 0),
        currentStock: Number(product.currentStock ?? 0),
    };
}

export default function StockAlertsPage() {
    return (
        <Suspense fallback={<TablePageSkeleton />}>
            <StockAlertsInner />
        </Suspense>
    );
}

function StockAlertsInner() {
    const { data } = useProductsPage();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const [prProduct, setPrProduct] = useState<any | null>(null);

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"ALL" | "CRITICAL" | "LOW_STOCK">("ALL");
    const [page, setPage] = useState(0);

    // Filter products with alert statuses only
    const alertProducts = useMemo(() => {
        if (!data?.products) return [];
        return data.products.filter(
            (p: any) => p.status === "CRITICAL" || p.status === "LOW_STOCK"
        );
    }, [data?.products]);

    const criticalCount = alertProducts.filter((p: any) => p.status === "CRITICAL").length;
    const lowStockCount = alertProducts.filter((p: any) => p.status === "LOW_STOCK").length;

    // Apply search + status filter
    const filtered = useMemo(() => {
        let items = alertProducts;
        if (statusFilter !== "ALL") {
            items = items.filter((p: any) => p.status === statusFilter);
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            items = items.filter(
                (p: any) =>
                    (p.code ?? "").toLowerCase().includes(q) ||
                    (p.name ?? "").toLowerCase().includes(q)
            );
        }
        return items;
    }, [alertProducts, statusFilter, search]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pagedItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    useEffect(() => {
        const buat = searchParams.get("buat");
        if (!buat || !data?.products) return;
        const found = data.products.find((p: any) => p.id === buat);
        if (found) setPrProduct(found);
    }, [data?.products, searchParams]);

    if (!data) return <TablePageSkeleton />;

    return (
        <div className="mf-page">

            {/* ═══════════════════════════════════════════ */}
            {/* COMMAND HEADER                              */}
            {/* ═══════════════════════════════════════════ */}
            <div className="border border-border shadow-sm overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-orange-500">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-blue-500" />
                        <div>
                            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                                Peringatan Stok
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Produk dengan stok rendah atau kritis yang memerlukan tindakan
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* KPI PULSE STRIP                            */}
            {/* ═══════════════════════════════════════════ */}
            <div className="bg-white dark:bg-zinc-900 border border-border shadow-sm overflow-hidden">
                <div className="grid grid-cols-3">
                    {/* Kritis */}
                    <div className="relative p-4 md:p-5 border-r border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-red-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <ShieldAlert className="h-4 w-4 text-zinc-400" />
                            <span className="text-xs font-semibold text-zinc-500">Kritis</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-semibold tracking-tighter text-red-600">
                            {criticalCount}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-xs font-bold text-red-600">Perlu tindakan segera</span>
                        </div>
                    </div>

                    {/* Stok Rendah */}
                    <div className="relative p-4 md:p-5 border-r border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingDown className="h-4 w-4 text-zinc-400" />
                            <span className="text-xs font-semibold text-zinc-500">Stok Rendah</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-semibold tracking-tighter text-amber-600">
                            {lowStockCount}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-xs font-bold text-amber-600">Segera restock</span>
                        </div>
                    </div>

                    {/* Total Peringatan */}
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-zinc-400" />
                            <span className="text-xs font-semibold text-zinc-500">Total Peringatan</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-semibold tracking-tighter text-zinc-900 dark:text-white">
                            {alertProducts.length}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-xs font-bold text-zinc-500">Semua peringatan aktif</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* SEARCH & FILTER BAR                        */}
            {/* ═══════════════════════════════════════════ */}
            <div className="bg-white dark:bg-zinc-900 border border-border shadow-sm overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3">
                    <div className="relative flex-1 max-w-lg">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari kode atau nama produk..."
                            className="pl-9 border border-border font-bold h-10 placeholder:text-zinc-400 rounded-md"
                        />
                    </div>
                    {/* Status filter toggle */}
                    <div className="flex border border-border">
                        {(["ALL", "CRITICAL", "LOW_STOCK"] as const).map((s) => (
                            <button
                                key={s}
                                onClick={() => { setStatusFilter(s); setPage(0); }}
                                className={`px-3 py-2 text-xs font-semibold   transition-all border-r border-border last:border-r-0 ${
                                    statusFilter === s
                                        ? "bg-slate-900 text-white"
                                        : "bg-white text-zinc-400 hover:bg-zinc-50"
                                }`}
                            >
                                {s === "ALL" ? "Semua" : s === "CRITICAL" ? "Kritis" : "Stok Rendah"}
                            </button>
                        ))}
                    </div>
                    <div className="text-xs font-semibold text-zinc-400 hidden md:block">
                        {filtered.length} hasil
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* ALERTS TABLE                               */}
            {/* ═══════════════════════════════════════════ */}
            <div className="bg-white dark:bg-zinc-900 border border-border shadow-sm overflow-hidden">
                {/* Section Header */}
                <div className="bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 border-b border-border flex items-center justify-between border-l-[5px] border-l-orange-500">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-blue-500" />
                        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Daftar Peringatan Stok</span>
                    </div>
                    <span className="text-xs font-semibold bg-zinc-200 text-zinc-800 border border-zinc-300 px-2 py-0.5">
                        {filtered.length}
                    </span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="bg-zinc-100 dark:bg-zinc-800 border-b border-border">
                                <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Kode</th>
                                <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Nama Produk</th>
                                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 text-center">Stok Saat Ini</th>
                                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 text-center">Min Stok</th>
                                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 text-center">Selisih</th>
                                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 text-center">Status</th>
                                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pagedItems.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center">
                                        <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-400 mb-2" />
                                        <p className="text-xs font-semibold text-zinc-400">
                                            Semua stok dalam kondisi baik!
                                        </p>
                                    </td>
                                </tr>
                            ) : pagedItems.map((product: any, idx: number) => {
                                const gap = (product.minStock ?? 0) - (product.currentStock ?? 0);
                                return (
                                    <tr
                                        key={product.id}
                                        className={`border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/80 transition-colors ${idx % 2 === 1 ? "bg-zinc-50/50" : ""
                                            }`}
                                    >
                                        {/* Kode */}
                                        <td className="px-4 py-3">
                                            <span className="font-mono font-bold text-xs text-zinc-700">
                                                {product.code ?? "-"}
                                            </span>
                                        </td>

                                        {/* Nama Produk */}
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-sm tracking-tight text-zinc-900">
                                                {product.name}
                                            </div>
                                            {product.category?.name && (
                                                <span className="inline-block mt-1 text-xs font-semibold bg-zinc-100 border border-zinc-200 text-zinc-600 px-1.5 py-0.5">
                                                    {product.category.name}
                                                </span>
                                            )}
                                        </td>

                                        {/* Stok Saat Ini */}
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-lg font-semibold font-mono text-zinc-900">
                                                {product.currentStock ?? 0}
                                            </span>
                                        </td>

                                        {/* Min Stok */}
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-base font-bold font-mono text-zinc-500">
                                                {product.minStock ?? 0}
                                            </span>
                                        </td>

                                        {/* Selisih */}
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-base font-semibold font-mono ${gap > 0 ? "text-red-600" : "text-emerald-600"}`}>
                                                {gap > 0 ? `-${gap}` : gap === 0 ? "0" : `+${Math.abs(gap)}`}
                                            </span>
                                        </td>

                                        {/* Status */}
                                        <td className="px-4 py-3 text-center">
                                            {product.status === "CRITICAL" ? (
                                                <span className="inline-block bg-red-50 text-red-700 border border-red-600 text-xs font-semibold px-2.5 py-1">
                                                    KRITIS
                                                </span>
                                            ) : (
                                                <span className="inline-block bg-amber-50 text-amber-700 border border-amber-600 text-xs font-semibold px-2.5 py-1">
                                                    RENDAH
                                                </span>
                                            )}
                                        </td>

                                        {/* Aksi */}
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex flex-col sm:flex-row items-center justify-center gap-1">
                                                <Button
                                                    size="sm"
                                                    onClick={() => setPrProduct(product)}
                                                    className={`${NB.toolbarBtnPrimary} ml-0 h-8 px-3 text-xs`}
                                                >
                                                    <ShoppingBag className="mr-1.5 h-3 w-3" />
                                                    Buat PR
                                                </Button>
                                                <Link href={`/inventory/products/${product.id}`}>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="border border-border shadow-sm hover:shadow-sm transition-all text-xs font-semibold h-8 px-3"
                                                    >
                                                        <ExternalLink className="mr-1.5 h-3 w-3" />
                                                        Lihat Detail
                                                    </Button>
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {filtered.length > PAGE_SIZE && (
                    <div className="border-t border-border px-4 py-2.5 flex items-center justify-between bg-zinc-50">
                        <span className="text-xs font-semibold text-zinc-400">
                            Halaman {page + 1} dari {pageCount}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="h-8 w-8 flex items-center justify-center border border-border bg-white hover:bg-slate-900 hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-black"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                                disabled={page >= pageCount - 1}
                                className="h-8 w-8 flex items-center justify-center border border-border bg-white hover:bg-slate-900 hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-black"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {prProduct && (
                <PurchaseRequestDialog
                    item={toPrItem(prProduct)}
                    hideTrigger
                    open={!!prProduct}
                    triggerLabel="Buat PR"
                    onOpenChange={(next) => {
                        if (!next) {
                            setPrProduct(null);
                            if (searchParams.get("buat")) {
                                router.replace(pathname);
                            }
                        }
                    }}
                />
            )}

        </div>
    );
}

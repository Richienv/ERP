"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    ClipboardList,
    Plus,
    Warehouse,
    Hash,
    Clock,
    Search,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { InventoryPerformanceProvider } from "@/components/inventory/inventory-performance-provider";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { getRecentAudits, submitSpotAudit, getProductsForKanban, getWarehouses } from "@/app/actions/inventory";
import { queryKeys } from "@/lib/query-keys";
import { NB } from "@/lib/dialog-styles";
import { ComboboxWithCreate } from "@/components/ui/combobox-with-create";

// Type based on our server action return
type AuditLog = {
    id: string;
    productName: string;
    warehouse: string;
    category: string;
    systemQty: number;
    actualQty: number;
    auditor: string;
    date: Date;
    status: string;
};

const PAGE_SIZE = 10;

const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
    Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))])

export default function InventoryAuditPage() {
    const queryClient = useQueryClient()

    const { data, isLoading } = useQuery({
        queryKey: queryKeys.inventoryAudit.list(),
        queryFn: async () => {
            const [logs, prods, whs] = await Promise.all([
                withTimeout(getRecentAudits(), 8000, []),
                withTimeout(getProductsForKanban(), 8000, []),
                withTimeout(getWarehouses(), 5000, [])
            ]);
            return {
                auditLogs: logs as AuditLog[],
                products: prods as any[],
                warehouses: whs as any[],
            };
        },
    })

    const auditLogs = data?.auditLogs ?? []
    const products = data?.products ?? []
    const warehouses = data?.warehouses ?? []
    const productOptions = useMemo(() =>
        products.map((p: any) => ({ value: p.id, label: p.name, subtitle: p.code })), [products])

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"ALL" | "MATCH" | "DISCREPANCY">("ALL");
    const [page, setPage] = useState(0);

    // Input Form State
    const [inputOpen, setInputOpen] = useState(false);
    const [formWarehouse, setFormWarehouse] = useState("");
    const [formProduct, setFormProduct] = useState("");
    const [formQty, setFormQty] = useState("");
    const [formAuditor, setFormAuditor] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Stats
    const matchCount = auditLogs.filter(l => l.status === "MATCH").length;
    const discrepancyCount = auditLogs.filter(l => l.status === "DISCREPANCY").length;

    // Filtered + paginated
    const filtered = useMemo(() => {
        let logs = auditLogs;
        if (statusFilter !== "ALL") {
            logs = logs.filter(l => l.status === statusFilter);
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            logs = logs.filter(l =>
                l.productName.toLowerCase().includes(q) ||
                l.warehouse.toLowerCase().includes(q) ||
                l.category.toLowerCase().includes(q)
            );
        }
        return logs;
    }, [auditLogs, statusFilter, search]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pagedLogs = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const handleConfirmInput = async () => {
        if (!formWarehouse || !formProduct || !formQty) {
            toast.error("Data Belum Lengkap", {
                description: "Mohon isi gudang, produk, dan jumlah fisik.",
            });
            return;
        }

        setSubmitting(true);
        try {
            const result = await submitSpotAudit({
                warehouseId: formWarehouse,
                productId: formProduct,
                actualQty: Number(formQty),
                auditorName: formAuditor || 'System',
                notes: 'Manual Input from Audit Page'
            });

            if (result.success) {
                toast.success("Data Stok Tersimpan!", {
                    description: "Audit berhasil direkam.",
                });
                setInputOpen(false);
                setFormProduct("");
                setFormQty("");
                setFormAuditor("");
                // Invalidate query so the table refreshes with new audit log
                queryClient.invalidateQueries({ queryKey: queryKeys.inventoryAudit.all });
            } else {
                toast.error("Gagal menyimpan audit");
            }
        } catch {
            toast.error("Terjadi kesalahan sistem");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <InventoryPerformanceProvider currentPath="/inventory/audit">
            <div className="mf-page">

                {/* ═══════════════════════════════════════════ */}
                {/* COMMAND HEADER                              */}
                {/* ═══════════════════════════════════════════ */}
                <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                    <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-emerald-400">
                        <div className="flex items-center gap-3">
                            <ClipboardList className="h-5 w-5 text-emerald-500" />
                            <div>
                                <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                    Stok Opname
                                </h1>
                                <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                    Pencatatan opname fisik & validasi inventaris
                                </p>
                            </div>
                        </div>
                        <Button
                            onClick={() => setInputOpen(true)}
                            className="bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider px-6 h-9"
                        >
                            <Plus className="mr-2 h-4 w-4" /> Input Opname
                        </Button>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════ */}
                {/* KPI PULSE STRIP                            */}
                {/* ═══════════════════════════════════════════ */}
                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="grid grid-cols-3">
                        {/* Total Audit */}
                        <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                            <div className="flex items-center gap-2 mb-2">
                                <ClipboardList className="h-4 w-4 text-zinc-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Audit</span>
                            </div>
                            <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">
                                {isLoading ? "—" : auditLogs.length}
                            </div>
                            <div className="flex items-center gap-1 mt-1.5">
                                <span className="text-[10px] font-bold text-emerald-600">Semua catatan</span>
                            </div>
                        </div>

                        {/* Match */}
                        <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                            <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="h-4 w-4 text-zinc-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Sesuai</span>
                            </div>
                            <div className="text-2xl md:text-3xl font-black tracking-tighter text-blue-600">
                                {isLoading ? "—" : matchCount}
                            </div>
                            <div className="flex items-center gap-1 mt-1.5">
                                <span className="text-[10px] font-bold text-blue-600">Fisik = Sistem</span>
                            </div>
                        </div>

                        {/* Discrepancy */}
                        <div className="relative p-4 md:p-5">
                            <div className="absolute top-0 left-0 right-0 h-1 bg-red-400" />
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="h-4 w-4 text-zinc-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Selisih</span>
                            </div>
                            <div className="text-2xl md:text-3xl font-black tracking-tighter text-red-600">
                                {isLoading ? "—" : discrepancyCount}
                            </div>
                            <div className="flex items-center gap-1 mt-1.5">
                                <span className="text-[10px] font-bold text-red-600">Perlu investigasi</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════ */}
                {/* SEARCH & FILTER BAR                        */}
                {/* ═══════════════════════════════════════════ */}
                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="px-4 py-3 flex items-center gap-3">
                        <div className="relative flex-1 max-w-lg">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari produk, gudang, atau kategori..."
                                className="pl-9 border-2 border-black font-bold h-10 placeholder:text-zinc-400 rounded-none"
                            />
                        </div>
                        {/* Status filter toggle */}
                        <div className="flex border-2 border-black">
                            {(["ALL", "MATCH", "DISCREPANCY"] as const).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => { setStatusFilter(s); setPage(0); }}
                                    className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all border-r border-black last:border-r-0 ${statusFilter === s
                                            ? "bg-black text-white"
                                            : "bg-white text-zinc-400 hover:bg-zinc-50"
                                        }`}
                                >
                                    {s === "ALL" ? "Semua" : s === "MATCH" ? "Sesuai" : "Selisih"}
                                </button>
                            ))}
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hidden md:block">
                            {filtered.length} hasil
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════ */}
                {/* AUDIT TABLE                                */}
                {/* ═══════════════════════════════════════════ */}
                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    {/* Section Header */}
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 px-4 py-2.5 border-b-2 border-black flex items-center justify-between border-l-[5px] border-l-emerald-400">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-emerald-600" />
                            <span className="text-xs font-black uppercase tracking-widest text-emerald-800">Log Hasil Opname</span>
                        </div>
                        <span className="text-[10px] font-black bg-emerald-200 text-emerald-800 border border-emerald-300 px-2 py-0.5">
                            {filtered.length}
                        </span>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead>
                                <tr className="bg-zinc-100 dark:bg-zinc-800 border-b-2 border-black">
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Waktu</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Produk & Lokasi</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Fisik vs Sistem</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={4} className="p-12 text-center">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-zinc-400 mb-2" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Memuat data...</p>
                                        </td>
                                    </tr>
                                ) : pagedLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-12 text-center">
                                            <ClipboardList className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Belum ada data audit</p>
                                        </td>
                                    </tr>
                                ) : pagedLogs.map((log, idx) => {
                                    const diff = log.actualQty - log.systemQty;
                                    return (
                                        <tr
                                            key={log.id}
                                            className={`border-b border-zinc-100 last:border-b-0 hover:bg-emerald-50/50 transition-colors ${idx % 2 === 1 ? "bg-zinc-50/50" : ""
                                                }`}
                                        >
                                            {/* Time */}
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-zinc-900 flex items-center gap-1.5 text-xs">
                                                        <Clock className="h-3 w-3 text-zinc-400" />
                                                        {format(new Date(log.date), 'HH:mm', { locale: idLocale })}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-zinc-400 mt-0.5">
                                                        {format(new Date(log.date), 'dd MMM yyyy', { locale: idLocale })}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Product */}
                                            <td className="px-4 py-3">
                                                <div className="font-black text-sm uppercase tracking-tight text-zinc-900">{log.productName}</div>
                                                <div className="text-[10px] font-bold text-zinc-400 mt-0.5 flex items-center gap-1.5">
                                                    <Warehouse className="h-3 w-3" /> {log.warehouse}
                                                </div>
                                                <span className="inline-block mt-1 text-[10px] font-black bg-zinc-100 border border-zinc-200 text-zinc-600 px-1.5 py-0.5">
                                                    {log.category}
                                                </span>
                                            </td>

                                            {/* Qty Comparison */}
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-3">
                                                    <div className="text-center">
                                                        <div className="text-[10px] uppercase font-black text-zinc-400 tracking-widest">Fisik</div>
                                                        <div className="text-lg font-black font-mono">{log.actualQty}</div>
                                                    </div>
                                                    <span className="text-zinc-300 font-black text-lg">/</span>
                                                    <div className="text-center">
                                                        <div className="text-[10px] uppercase font-black text-zinc-400 tracking-widest">Sistem</div>
                                                        <div className="text-base font-bold font-mono text-zinc-500">{log.systemQty}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Status */}
                                            <td className="px-4 py-3 text-center">
                                                {log.status === 'MATCH' ? (
                                                    <span className="inline-block bg-emerald-50 text-emerald-700 border-2 border-emerald-600 text-[10px] font-black uppercase tracking-wider px-2.5 py-1">
                                                        SESUAI
                                                    </span>
                                                ) : (
                                                    <span className="inline-block bg-red-50 text-red-700 border-2 border-red-600 text-[10px] font-black uppercase tracking-wider px-2.5 py-1">
                                                        SELISIH {diff > 0 ? `+${diff}` : diff}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {!isLoading && filtered.length > PAGE_SIZE && (
                        <div className="border-t-2 border-black px-4 py-2.5 flex items-center justify-between bg-zinc-50">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                Halaman {page + 1} dari {pageCount}
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPage(p => Math.max(0, p - 1))}
                                    disabled={page === 0}
                                    className="h-8 w-8 flex items-center justify-center border-2 border-black bg-white hover:bg-black hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-black"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                                    disabled={page >= pageCount - 1}
                                    className="h-8 w-8 flex items-center justify-center border-2 border-black bg-white hover:bg-black hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-black"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ═══════════════════════════════════════════ */}
                {/* INPUT OPNAME DIALOG                        */}
                {/* ═══════════════════════════════════════════ */}
                <Dialog open={inputOpen} onOpenChange={setInputOpen}>
                    <DialogContent className={NB.content}>
                        <DialogHeader className={NB.header}>
                            <DialogTitle className={NB.title}>
                                <Hash className="h-5 w-5" /> Form Opname Fisik
                            </DialogTitle>
                            <p className={NB.subtitle}>Catat hasil penghitungan stok fisik di gudang.</p>
                        </DialogHeader>

                        <ScrollArea className={NB.scroll}>
                            <div className="p-5 space-y-4">
                                {/* Location Section */}
                                <div className={NB.section}>
                                    <div className={`${NB.sectionHead} border-l-4 border-l-emerald-400 bg-emerald-50`}>
                                        <Warehouse className="h-4 w-4" />
                                        <span className={NB.sectionTitle}>Lokasi & Produk</span>
                                    </div>
                                    <div className={NB.sectionBody}>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className={NB.label}>Gudang Target <span className={NB.labelRequired}>*</span></label>
                                                <Select value={formWarehouse} onValueChange={setFormWarehouse}>
                                                    <SelectTrigger className={NB.select}>
                                                        <SelectValue placeholder="Pilih Gudang..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {warehouses.map(w => (
                                                            <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <label className={NB.label}>Produk <span className={NB.labelRequired}>*</span></label>
                                                <ComboboxWithCreate
                                                    options={productOptions}
                                                    value={formProduct}
                                                    onChange={setFormProduct}
                                                    placeholder="Pilih produk..."
                                                    searchPlaceholder="Cari produk..."
                                                    emptyMessage="Produk tidak ditemukan."
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Counting Section */}
                                <div className={NB.section}>
                                    <div className={`${NB.sectionHead} border-l-4 border-l-blue-400 bg-blue-50`}>
                                        <Hash className="h-4 w-4" />
                                        <span className={NB.sectionTitle}>Penghitungan</span>
                                    </div>
                                    <div className={NB.sectionBody}>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className={NB.label}>Jumlah Fisik <span className={NB.labelRequired}>*</span></label>
                                                <Input
                                                    type="number"
                                                    value={formQty}
                                                    onChange={(e) => setFormQty(e.target.value)}
                                                    placeholder="0"
                                                    className={NB.inputMono + " text-lg"}
                                                />
                                            </div>
                                            <div>
                                                <label className={NB.label}>Catatan / Ref</label>
                                                <Input
                                                    value={formAuditor}
                                                    onChange={(e) => setFormAuditor(e.target.value)}
                                                    placeholder="No PO / Auditor"
                                                    className={NB.input}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className={NB.footer}>
                                    <Button type="button" variant="outline" className={NB.cancelBtn} onClick={() => setInputOpen(false)}>
                                        Batal
                                    </Button>
                                    <Button onClick={handleConfirmInput} disabled={submitting} className={NB.submitBtn}>
                                        {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : "Konfirmasi & Simpan"}
                                    </Button>
                                </div>
                            </div>
                        </ScrollArea>
                    </DialogContent>
                </Dialog>

            </div>
        </InventoryPerformanceProvider>
    );
}

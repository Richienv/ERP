"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    ClipboardList,
    Plus,
    Warehouse,
    Layers,
    Package,
    Hash,
    Clock,
    Truck,
    MoreHorizontal,
    Pencil,
    Trash2,
    ArrowUpRight,
    DollarSign,
    Filter,
    Loader2
} from "lucide-react";
import { InventoryPerformanceProvider } from "@/components/inventory/inventory-performance-provider";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster, toast } from "sonner";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { getRecentAudits, submitSpotAudit, getProductsForKanban, getWarehouses } from "@/app/actions/inventory";

// Type based on our server action return
type AuditLog = {
    id: string;
    productName: string;
    warehouse: string;
    category: string;
    systemQty: number;
    actualQty: number;
    auditor: string;
    updatedAt: Date;
    status: string; // 'MATCH' | 'DISCREPANCY'
    vendorName: string;
    poNumber: string;
    invoiceNumber: string;
    paymentStatus: string;
};

export default function InventoryAuditPage() {
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [filterMonth, setFilterMonth] = useState("10");
    const [filterYear, setFilterYear] = useState("2024");

    // Input Form State
    const [inputOpen, setInputOpen] = useState(false);
    const [formWarehouse, setFormWarehouse] = useState("");
    const [formProduct, setFormProduct] = useState("");
    const [formQty, setFormQty] = useState("");
    const [formAuditor, setFormAuditor] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [logs, prods, whs] = await Promise.all([
                getRecentAudits(),
                getProductsForKanban(),
                getWarehouses()
            ]);
            setAuditLogs(logs);
            setProducts(prods);
            setWarehouses(whs);
        } catch (e) {
            toast.error("Gagal memuat data audit");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmInput = async () => {
        if (!formWarehouse || !formProduct || !formQty) {
            toast.error("Data Belum Lengkap", {
                description: "Mohon isi gudang, produk, dan jumlah fisik.",
                className: "border-2 border-black font-bold bg-white text-red-600"
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
                    className: "border-2 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white text-green-700"
                });
                setInputOpen(false);
                setFormProduct("");
                setFormQty("");
                loadData(); // Reload logs
            } else {
                toast.error("Gagal menyimpan audit");
            }
        } catch (error) {
            toast.error("Terjadi kesalahan sistem");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <InventoryPerformanceProvider currentPath="/inventory/audit">
            <div className="flex-1 p-4 md:p-8 pt-6 bg-zinc-50/50 dark:bg-black min-h-screen font-sans">
                <Toaster position="top-center" toastOptions={{ className: 'rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' }} />

                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h2 className="text-4xl font-black tracking-tighter uppercase flex items-center gap-3">
                            <ClipboardList className="h-8 w-8" /> Auditor Stok
                        </h2>
                        <p className="text-muted-foreground font-bold mt-1">
                            Pencatatan opname fisik & validasi inventaris.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        <Select value={filterMonth} onValueChange={setFilterMonth}>
                            <SelectTrigger className="w-[140px] h-12 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold rounded-xl bg-white">
                                <SelectValue placeholder="Bulan" />
                            </SelectTrigger>
                            <SelectContent className="border-2 border-black font-bold" usePortal={false}>
                                <SelectItem value="10">Oktober</SelectItem>
                                <SelectItem value="11">November</SelectItem>
                                <SelectItem value="12">Desember</SelectItem>
                            </SelectContent>
                        </Select>

                        <Dialog open={inputOpen} onOpenChange={setInputOpen}>
                            <DialogTrigger asChild>
                                <Button className="h-12 px-6 font-black uppercase tracking-wide border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all bg-black text-white hover:bg-zinc-800 rounded-xl ml-2">
                                    <Plus className="mr-2 h-5 w-5" /> Input Stok Manual
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 gap-0 overflow-hidden rounded-xl bg-white">
                                <div className="bg-zinc-100 p-6 border-b-2 border-black">
                                    <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                                        <Hash className="h-6 w-6" /> Form Opname Fisik
                                    </DialogTitle>
                                </div>
                                <div className="p-6 grid grid-cols-2 gap-6">
                                    <div className="space-y-4 col-span-2 md:col-span-1">
                                        <div className="space-y-2">
                                            <label className="text-sm font-black uppercase flex items-center gap-2">
                                                <Warehouse className="h-4 w-4" /> Gudang Target
                                            </label>
                                            <Select value={formWarehouse} onValueChange={setFormWarehouse}>
                                                <SelectTrigger className="h-10 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold rounded-lg bg-white">
                                                    <SelectValue placeholder="Pilih Gudang..." />
                                                </SelectTrigger>
                                                <SelectContent className="border-2 border-black font-bold" usePortal={false}>
                                                    {warehouses.map(w => (
                                                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-black uppercase flex items-center gap-2">
                                                <Package className="h-4 w-4" /> Produk
                                            </label>
                                            <Select value={formProduct} onValueChange={setFormProduct}>
                                                <SelectTrigger className="h-10 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold rounded-lg bg-white">
                                                    <SelectValue placeholder="Pilih Produk..." />
                                                </SelectTrigger>
                                                <SelectContent className="border-2 border-black font-bold max-h-[200px]" usePortal={false}>
                                                    {products.map(p => (
                                                        <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-4 col-span-2 md:col-span-1">
                                        <div className="space-y-2">
                                            <label className="text-sm font-black uppercase flex items-center gap-2">
                                                <Hash className="h-4 w-4" /> Jumlah Fisik
                                            </label>
                                            <Input
                                                type="number"
                                                value={formQty}
                                                onChange={(e) => setFormQty(e.target.value)}
                                                placeholder="0"
                                                className="h-10 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold rounded-lg text-lg font-mono"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-black uppercase flex items-center gap-2">
                                                <Truck className="h-4 w-4" /> Catatan / Ref
                                            </label>
                                            <Input
                                                value={formAuditor}
                                                onChange={(e) => setFormAuditor(e.target.value)}
                                                placeholder="Opsional (No PO / Auditor)"
                                                className="h-10 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold rounded-lg"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter className="p-6 bg-zinc-50 border-t-2 border-black flex gap-2">
                                    <Button variant="outline" onClick={() => setInputOpen(false)} className="flex-1 h-12 font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-[1px]">
                                        Batal
                                    </Button>
                                    <Button onClick={handleConfirmInput} disabled={submitting} className="flex-1 h-12 font-black uppercase bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] transition-all">
                                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Konfirmasi & Simpan
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* Audit Table */}
                <Card className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-white rounded-xl overflow-hidden min-h-[500px]">
                    <CardHeader className="bg-white border-b-2 border-black py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <CardTitle className="text-xl font-black uppercase tracking-wide flex items-center gap-2">
                            <Clock className="h-5 w-5" /> Log Hasil Opname
                        </CardTitle>
                        <div className="flex gap-2">
                            <div className="relative">
                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                <Input className="h-9 pl-8 w-[200px] border-2 border-black text-xs font-bold" placeholder="Filter hasil..." />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs font-black uppercase bg-zinc-100 text-zinc-500 border-b-2 border-black">
                                    <tr>
                                        <th className="px-6 py-4">Waktu (Audit)</th>
                                        <th className="px-6 py-4">Produk & Lokasi</th>
                                        <th className="px-6 py-4 text-center">Fisik vs Sistem</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200">
                                    {loading ? (
                                        <tr><td colSpan={5} className="p-8 text-center text-zinc-500 font-bold">Memuat Data...</td></tr>
                                    ) : auditLogs.length === 0 ? (
                                        <tr><td colSpan={5} className="p-8 text-center text-zinc-400 font-bold italic">Belum ada data audit.</td></tr>
                                    ) : auditLogs.map((log) => {
                                        const diff = log.actualQty - log.systemQty;

                                        return (
                                            <tr key={log.id} className="hover:bg-yellow-50 transition-colors group">
                                                {/* Time Column */}
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-zinc-900 flex items-center gap-2">
                                                            <Clock className="h-3 w-3 text-zinc-400" />
                                                            {format(new Date(log.updatedAt), 'HH:mm', { locale: id })}
                                                        </span>
                                                        <span className="text-xs font-bold text-muted-foreground">
                                                            {format(new Date(log.updatedAt), 'dd MMM yyyy', { locale: id })}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Product Column */}
                                                <td className="px-6 py-4">
                                                    <div className="font-black text-base uppercase tracking-tight">{log.productName}</div>
                                                    <div className="text-xs font-bold text-muted-foreground mt-1 flex items-center gap-2">
                                                        <Warehouse className="h-3 w-3" /> {log.warehouse}
                                                    </div>
                                                    <Badge variant="secondary" className="mt-1 text-[10px] font-bold border border-zinc-200">{log.category}</Badge>
                                                </td>

                                                {/* Qty Column */}
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-4">
                                                        <div className="text-center">
                                                            <div className="text-[10px] uppercase font-bold text-zinc-400">Fisik</div>
                                                            <div className="text-xl font-black">{log.actualQty}</div>
                                                        </div>
                                                        <span className="text-zinc-300 font-black">/</span>
                                                        <div className="text-center">
                                                            <div className="text-[10px] uppercase font-bold text-zinc-400">Sistem</div>
                                                            <div className="text-base font-bold text-zinc-500">{log.systemQty}</div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Status Column */}
                                                <td className="px-6 py-4 text-center">
                                                    {log.status === 'MATCH' && (
                                                        <Badge className="bg-green-100 text-green-700 border-2 border-green-600 font-bold hover:bg-green-200">
                                                            SESUAI
                                                        </Badge>
                                                    )}
                                                    {log.status === 'DISCREPANCY' && (
                                                        <Badge className="bg-red-100 text-red-700 border-2 border-red-600 font-bold hover:bg-red-200 animate-pulse">
                                                            SELISIH {diff > 0 ? `+${diff}` : diff}
                                                        </Badge>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </InventoryPerformanceProvider>
    );
}

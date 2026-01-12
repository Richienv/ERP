"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    ClipboardList,
    Plus,
    Barcode,
    CheckCircle2,
    AlertTriangle,
    History,
    Save,
    ScanLine,
    Filter,
    Calendar, // Keeping if needed for future, but likely unused based on analysis
    User,
    Warehouse,
    Layers,
    Package,
    Hash,
    Clock,
    FileText,
    Truck,
    MoreHorizontal,
    Pencil,
    Trash2,
    ArrowUpRight,
    DollarSign
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
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
import { cn } from "@/lib/utils";
import { Toaster, toast } from "sonner";
import { format } from "date-fns";
import { id } from "date-fns/locale";

// Extended Type Definition
type AuditLog = {
    id: string;
    productName: string;
    warehouse: string;
    category: string;
    systemQty: number;
    actualQty: number;
    auditor: string;
    updatedAt: Date;
    status: 'MATCH' | 'DISCREPANCY' | 'NEW_ITEM';
    // New Finance/Procurement Fields
    vendorName: string;
    poNumber: string; // Purchase Order
    invoiceNumber: string;
    paymentStatus: 'PAID' | 'UNPAID' | 'OVERDUE' | 'PARTIAL';
};

// Mock Initial Data (Enriched)
const INITIAL_LOGS: AuditLog[] = [
    {
        id: "LOG-001",
        productName: "Cotton Combed 30s - Putih",
        warehouse: "Gudang A - Bahan Baku",
        category: "RAW",
        systemQty: 150,
        actualQty: 150,
        auditor: "Budi Santoso",
        updatedAt: new Date("2024-10-12T09:30:00"),
        status: 'MATCH',
        vendorName: "PT. Tekstil Sejahtera",
        poNumber: "PO-24-001",
        invoiceNumber: "INV-TS-99",
        paymentStatus: 'UNPAID' // Verified & Unpaid - Opportunity for action
    },
    {
        id: "LOG-002",
        productName: "Rayon Viscose - Merah",
        warehouse: "Gudang A - Bahan Baku",
        category: "RAW",
        systemQty: 80,
        actualQty: 75,
        auditor: "Siti Aminah",
        updatedAt: new Date("2024-10-12T10:15:00"),
        status: 'DISCREPANCY',
        vendorName: "CV. Benang Emas",
        poNumber: "PO-24-032",
        invoiceNumber: "INV-BE-45",
        paymentStatus: 'PAID' // Paid but missing stock - Alarm!
    },
    {
        id: "LOG-003",
        productName: "Kancing 24L - Hitam",
        warehouse: "Gudang C - Distribusi",
        category: "ACC",
        systemQty: 5000,
        actualQty: 5000,
        auditor: "Rudi Hartono",
        updatedAt: new Date("2024-10-11T14:20:00"),
        status: 'MATCH',
        vendorName: "UD. Sumber Aksesoris",
        poNumber: "PO-24-015",
        invoiceNumber: "INV-SA-12",
        paymentStatus: 'PAID'
    },
];

export default function StockAuditPage() {
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_LOGS);
    const [filterMonth, setFilterMonth] = useState("10");
    const [filterYear, setFilterYear] = useState("2024");

    // Input Form State
    const [inputOpen, setInputOpen] = useState(false);
    const [formWarehouse, setFormWarehouse] = useState("");
    const [formCategory, setFormCategory] = useState("");
    const [formProduct, setFormProduct] = useState("");
    const [formQty, setFormQty] = useState("");
    const [formAuditor, setFormAuditor] = useState("");

    // New Input States
    const [formVendor, setFormVendor] = useState("");
    const [formRefNumber, setFormRefNumber] = useState(""); // PO or Invoice

    const handleConfirmInput = () => {
        if (!formWarehouse || !formCategory || !formProduct || !formQty || !formAuditor || !formVendor) {
            toast.error("Data Belum Lengkap", {
                description: "Mohon isi semua kolom wajib, termasuk Vendor.",
                className: "border-2 border-black font-bold bg-white text-red-600"
            });
            return;
        }

        const qtyNum = parseInt(formQty);
        const isNew = formProduct.toLowerCase().includes("baru");
        const systemVal = isNew ? 0 : qtyNum;
        const finalSystemVal = isNew ? 0 : (Math.random() > 0.8 ? qtyNum + 5 : qtyNum); // 20% discrepancy chance

        const newLog: AuditLog = {
            id: `LOG-${Math.floor(Math.random() * 10000)}`,
            productName: formProduct,
            warehouse: formWarehouse === 'WH-A' ? 'Gudang A - Bahan Baku' : formWarehouse === 'WH-B' ? 'Gudang B - Barang Jadi' : 'Gudang C - Distribusi',
            category: formCategory,
            systemQty: finalSystemVal,
            actualQty: qtyNum,
            auditor: formAuditor === 'BUDI' ? 'Budi Santoso' : formAuditor === 'SITI' ? 'Siti Aminah' : 'Rudi Hartono',
            updatedAt: new Date(),
            status: isNew ? 'NEW_ITEM' : (qtyNum === finalSystemVal ? 'MATCH' : 'DISCREPANCY'),
            vendorName: formVendor === 'V1' ? 'PT. Tekstil Sejahtera' : formVendor === 'V2' ? 'CV. Benang Emas' : 'UD. Sumber Aksesoris',
            poNumber: formRefNumber || "PO-Unknown",
            invoiceNumber: "PENDING",
            paymentStatus: 'UNPAID'
        };

        setAuditLogs([newLog, ...auditLogs]);

        toast.success("Data Stok Tersimpan!", {
            description: `${formProduct} berhasil diaudit.`,
            className: "border-2 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white text-green-700"
        });

        setInputOpen(false);
        setFormProduct("");
        setFormQty("");
        setFormRefNumber("");
    };

    const handleDelete = (id: string) => {
        setAuditLogs(auditLogs.filter(Log => Log.id !== id));
        toast.success("Log Dihapus", { className: "border-2 border-black font-bold bg-white" });
    }

    const handlePayAction = (log: AuditLog) => {
        toast.success("Pembayaran Diproses!", {
            description: `Mengirim perintah bayar untuk Invoice ${log.invoiceNumber} (${log.vendorName})`,
            className: "border-2 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-green-100 text-green-900 icon:text-green-900"
        });
    }

    return (
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
                        <SelectContent className="border-2 border-black font-bold">
                            <SelectItem value="10">Oktober</SelectItem>
                            <SelectItem value="11">November</SelectItem>
                            <SelectItem value="12">Desember</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={filterYear} onValueChange={setFilterYear}>
                        <SelectTrigger className="w-[100px] h-12 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold rounded-xl bg-white">
                            <SelectValue placeholder="Tahun" />
                        </SelectTrigger>
                        <SelectContent className="border-2 border-black font-bold">
                            <SelectItem value="2024">2024</SelectItem>
                            <SelectItem value="2025">2025</SelectItem>
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
                                    <ScanLine className="h-6 w-6" /> Form Opname Fisik
                                </DialogTitle>
                            </div>
                            <div className="p-6 grid grid-cols-2 gap-6">
                                {/* Left Column: Physical details */}
                                <div className="space-y-4">
                                    <h4 className="font-black uppercase text-xs text-muted-foreground border-b border-black/10 pb-2 mb-4">Detail Fisik Barang</h4>

                                    <div className="space-y-2">
                                        <label className="text-sm font-black uppercase flex items-center gap-2">
                                            <Warehouse className="h-4 w-4" /> Gudang Target
                                        </label>
                                        <Select value={formWarehouse} onValueChange={setFormWarehouse}>
                                            <SelectTrigger className="h-10 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold rounded-lg bg-white">
                                                <SelectValue placeholder="Pilih Gudang..." />
                                            </SelectTrigger>
                                            <SelectContent className="border-2 border-black font-bold">
                                                <SelectItem value="WH-A">Gudang A - Bahan Baku</SelectItem>
                                                <SelectItem value="WH-B">Gudang B - Barang Jadi</SelectItem>
                                                <SelectItem value="WH-C">Gudang C - Distribusi</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-black uppercase flex items-center gap-2">
                                            <Layers className="h-4 w-4" /> Kategori
                                        </label>
                                        <Select value={formCategory} onValueChange={setFormCategory}>
                                            <SelectTrigger className="h-10 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold rounded-lg bg-white">
                                                <SelectValue placeholder="Pilih Kategori..." />
                                            </SelectTrigger>
                                            <SelectContent className="border-2 border-black font-bold">
                                                <SelectItem value="RAW">Bahan Baku (Kain)</SelectItem>
                                                <SelectItem value="ACC">Aksesoris</SelectItem>
                                                <SelectItem value="FG">Barang Jadi</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-black uppercase flex items-center gap-2">
                                            <Package className="h-4 w-4" /> Nama Produk
                                        </label>
                                        <Input
                                            value={formProduct}
                                            onChange={(e) => setFormProduct(e.target.value)}
                                            placeholder="Contoh: Kain Katun..."
                                            className="h-10 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold rounded-lg"
                                        />
                                    </div>

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
                                </div>

                                {/* Right Column: Reference & Responsibility */}
                                <div className="space-y-4">
                                    <h4 className="font-black uppercase text-xs text-muted-foreground border-b border-black/10 pb-2 mb-4">Referensi & Vendor</h4>

                                    <div className="space-y-2">
                                        <label className="text-sm font-black uppercase flex items-center gap-2">
                                            <Truck className="h-4 w-4" /> Vendor Supplier
                                        </label>
                                        <Select value={formVendor} onValueChange={setFormVendor}>
                                            <SelectTrigger className="h-10 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold rounded-lg bg-white">
                                                <SelectValue placeholder="Pilih Vendor..." />
                                            </SelectTrigger>
                                            <SelectContent className="border-2 border-black font-bold">
                                                <SelectItem value="V1">PT. Tekstil Sejahtera</SelectItem>
                                                <SelectItem value="V2">CV. Benang Emas</SelectItem>
                                                <SelectItem value="V3">UD. Sumber Aksesoris</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-black uppercase flex items-center gap-2">
                                            <FileText className="h-4 w-4" /> No. Ref (PO/Invoice)
                                        </label>
                                        <Select value={formRefNumber} onValueChange={setFormRefNumber}>
                                            <SelectTrigger className="h-10 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold rounded-lg bg-white">
                                                <SelectValue placeholder="Pilih Referensi..." />
                                            </SelectTrigger>
                                            <SelectContent className="border-2 border-black font-bold">
                                                <SelectItem value="PO-24-1001">PO-24-1001 (Pending)</SelectItem>
                                                <SelectItem value="PO-24-1002">PO-24-1002 (Partial)</SelectItem>
                                                <SelectItem value="INV-OCT-001">INV-OCT-001 (Paid)</SelectItem>
                                                <SelectItem value="INV-OCT-002">INV-OCT-002 (Unpaid)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2 pt-8">
                                        <label className="text-sm font-black uppercase flex items-center gap-2">
                                            <User className="h-4 w-4" /> Auditor Bertugas
                                        </label>
                                        <Select value={formAuditor} onValueChange={setFormAuditor}>
                                            <SelectTrigger className="h-10 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold rounded-lg bg-white">
                                                <SelectValue placeholder="Pilih Petugas..." />
                                            </SelectTrigger>
                                            <SelectContent className="border-2 border-black font-bold">
                                                <SelectItem value="BUDI">Budi Santoso</SelectItem>
                                                <SelectItem value="SITI">Siti Aminah</SelectItem>
                                                <SelectItem value="RUDI">Rudi Hartono</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter className="p-6 bg-zinc-50 border-t-2 border-black flex gap-2">
                                <Button variant="outline" onClick={() => setInputOpen(false)} className="flex-1 h-12 font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-[1px]">
                                    Batal
                                </Button>
                                <Button onClick={handleConfirmInput} className="flex-1 h-12 font-black uppercase bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] transition-all">
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
                        <History className="h-5 w-5" /> Log Hasil Opname
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
                                    <th className="px-6 py-4">Referensi Vendor</th>
                                    <th className="px-6 py-4 text-center">Fisik vs Sistem</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200">
                                {auditLogs.map((log) => {
                                    const diff = log.actualQty - log.systemQty;
                                    const isVerified = log.status === 'MATCH';
                                    const isUnpaid = log.paymentStatus === 'UNPAID';

                                    return (
                                        <tr key={log.id} className="hover:bg-yellow-50 transition-colors group">
                                            {/* Time Column */}
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-zinc-900 flex items-center gap-2">
                                                        <Clock className="h-3 w-3 text-zinc-400" />
                                                        {format(log.updatedAt, 'HH:mm', { locale: id })}
                                                    </span>
                                                    <span className="text-xs font-bold text-muted-foreground">
                                                        {format(log.updatedAt, 'dd MMM yyyy', { locale: id })}
                                                    </span>
                                                    <Badge variant="outline" className="mt-2 w-fit border-zinc-300 text-[10px] font-mono font-bold bg-white">
                                                        {log.auditor}
                                                    </Badge>
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

                                            {/* Vendor / Reference Column (NEW) */}
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <div className="font-bold text-sm flex items-center gap-2">
                                                        <Truck className="h-3 w-3 text-zinc-500" /> {log.vendorName}
                                                    </div>
                                                    <div className="flex gap-2 mt-1">
                                                        <Badge variant="outline" className="bg-white border-black/20 text-[10px] font-mono">
                                                            {log.poNumber}
                                                        </Badge>
                                                        <Badge variant="outline" className="bg-white border-black/20 text-[10px] font-mono">
                                                            {log.invoiceNumber}
                                                        </Badge>
                                                    </div>
                                                    {/* Payment Status Indicator */}
                                                    <div className="mt-1">
                                                        {log.paymentStatus === 'PAID' && <span className="text-[10px] font-black text-green-600 bg-green-50 px-1 rounded">LUNAS</span>}
                                                        {log.paymentStatus === 'UNPAID' && <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-1 rounded">BELUM DIBAYAR</span>}
                                                        {log.paymentStatus === 'OVERDUE' && <span className="text-[10px] font-black text-red-600 bg-red-50 px-1 rounded">JATUH TEMPO</span>}
                                                    </div>
                                                </div>
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
                                                {log.status === 'NEW_ITEM' && (
                                                    <Badge className="bg-blue-100 text-blue-700 border-2 border-blue-600 font-bold hover:bg-blue-200">
                                                        PRODUK BARU
                                                    </Badge>
                                                )}
                                            </td>

                                            {/* Actions Column (Rich) */}
                                            <td className="px-6 py-4 text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0 border-2 border-transparent hover:border-black rounded-lg">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-[200px] border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold">
                                                        <DropdownMenuLabel>Aksi Item</DropdownMenuLabel>
                                                        <DropdownMenuSeparator className="bg-black/10" />
                                                        <DropdownMenuItem className="cursor-pointer focus:bg-zinc-100 font-medium">
                                                            <Pencil className="mr-2 h-4 w-4" /> Edit Data
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="cursor-pointer focus:bg-zinc-100 font-medium group">
                                                            <ArrowUpRight className="mr-2 h-4 w-4" />
                                                            Lihat PO
                                                        </DropdownMenuItem>

                                                        <DropdownMenuSeparator className="bg-black/10" />

                                                        {/* Creative Payment Action */}
                                                        {isVerified && isUnpaid && (
                                                            <DropdownMenuItem
                                                                onClick={() => handlePayAction(log)}
                                                                className="cursor-pointer bg-green-50 focus:bg-green-100 text-green-700 font-bold"
                                                            >
                                                                <DollarSign className="mr-2 h-4 w-4" />
                                                                Bayar Invoice
                                                            </DropdownMenuItem>
                                                        )}

                                                        <DropdownMenuSeparator className="bg-black/10" />
                                                        <DropdownMenuItem
                                                            onClick={() => handleDelete(log.id)}
                                                            className="cursor-pointer focus:bg-red-50 text-red-600 font-bold"
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" /> Hapus
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div >
    );
}

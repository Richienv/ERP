"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  Plus,
  Warehouse,
  Package,
  Hash,
  Clock,
  Filter,
  Loader2,
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
import { Toaster, toast } from "sonner";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useAuth } from "@/lib/auth-context";
import {
  approveStockOpnameAdjustment,
  getPendingStockOpnameAdjustments,
  getProductsForKanban,
  getRecentAudits,
  getWarehouses,
  rejectStockOpnameAdjustment,
  submitSpotAudit,
} from "@/app/actions/inventory";

type AuditLog = {
  id: string;
  productName: string;
  warehouse: string;
  category: string;
  systemQty: number;
  actualQty: number;
  auditor: string;
  date: Date;
  status: "MATCH" | "MISMATCH";
};

type PendingAdjustment = Awaited<ReturnType<typeof getPendingStockOpnameAdjustments>>[number];

export default function InventoryAuditPage() {
  const { user } = useAuth();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [pendingAdjustments, setPendingAdjustments] = useState<PendingAdjustment[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterMonth, setFilterMonth] = useState("10");

  const [inputOpen, setInputOpen] = useState(false);
  const [formWarehouse, setFormWarehouse] = useState("");
  const [formProduct, setFormProduct] = useState("");
  const [formQty, setFormQty] = useState("");
  const [formAuditor, setFormAuditor] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canApprove = ["ROLE_MANAGER", "ROLE_CEO", "ROLE_DIRECTOR", "ROLE_ADMIN"].includes(user?.role || "");

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      const [logs, prods, whs, pending] = await Promise.all([
        getRecentAudits(),
        getProductsForKanban(),
        getWarehouses(),
        getPendingStockOpnameAdjustments(),
      ]);
      setAuditLogs(logs as AuditLog[]);
      setProducts(prods);
      setWarehouses(whs);
      setPendingAdjustments(pending);
    } catch {
      toast.error("Gagal memuat data audit");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmInput = async () => {
    if (!formWarehouse || !formProduct || !formQty) {
      toast.error("Data Belum Lengkap", {
        description: "Mohon isi gudang, produk, dan jumlah fisik.",
        className: "border-2 border-black font-bold bg-white text-red-600",
      });
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitSpotAudit({
        warehouseId: formWarehouse,
        productId: formProduct,
        actualQty: Number(formQty),
        auditorName: formAuditor || "System",
        notes: "Manual Input from Audit Page",
      });

      if (result.success) {
        const requiresApproval = "requiresApproval" in result ? result.requiresApproval : false
        const resultMessage = "message" in result ? result.message : ""
        toast.success("Data Opname Terkirim", {
          description: requiresApproval
            ? "Selisih dikirim ke manager/boss untuk approval."
            : resultMessage || "Tidak ada selisih.",
          className:
            "border-2 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white text-green-700",
        });
        setInputOpen(false);
        setFormProduct("");
        setFormQty("");
        setFormAuditor("");
        await loadData();
      } else {
        toast.error("Gagal menyimpan audit");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveAdjustment = async (taskId: string) => {
    const res = await approveStockOpnameAdjustment(taskId);
    if (!res.success) {
      toast.error(("error" in res && res.error) || "Approval gagal");
      return;
    }
    toast.success("Stock opname adjustment approved");
    await loadData();
  };

  const handleRejectAdjustment = async (taskId: string) => {
    const res = await rejectStockOpnameAdjustment(taskId, "Rejected from Inventory Audit page");
    if (!res.success) {
      toast.error(("error" in res && res.error) || "Reject gagal");
      return;
    }
    toast.success("Stock opname adjustment rejected");
    await loadData();
  };

  return (
    <InventoryPerformanceProvider currentPath="/inventory/audit">
      <div className="flex-1 p-4 md:p-8 pt-6 bg-zinc-50/50 dark:bg-black min-h-screen font-sans">
        <Toaster
          position="top-center"
          toastOptions={{ className: "rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" }}
        />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-4xl font-black tracking-tighter uppercase flex items-center gap-3">
              <ClipboardList className="h-8 w-8" /> Auditor Stok
            </h2>
            <p className="text-muted-foreground font-bold mt-1">Pencatatan opname fisik & validasi inventaris.</p>
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
                          {warehouses.map((w) => (
                            <SelectItem key={w.id} value={w.id}>
                              {w.name}
                            </SelectItem>
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
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.code} - {p.name}
                            </SelectItem>
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
                        <Clock className="h-4 w-4" /> Auditor / Catatan
                      </label>
                      <Input
                        value={formAuditor}
                        onChange={(e) => setFormAuditor(e.target.value)}
                        placeholder="Opsional"
                        className="h-10 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold rounded-lg"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter className="p-6 bg-zinc-50 border-t-2 border-black flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setInputOpen(false)}
                    className="flex-1 h-12 font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-[1px]"
                  >
                    Batal
                  </Button>
                  <Button
                    onClick={handleConfirmInput}
                    disabled={submitting}
                    className="flex-1 h-12 font-black uppercase bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] transition-all"
                  >
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit For Approval
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-white rounded-xl overflow-hidden mb-8">
          <CardHeader className="bg-zinc-100 border-b-2 border-black py-4">
            <CardTitle className="text-lg font-black uppercase tracking-wide flex items-center justify-between">
              <span>Pending Stock Opname Approval</span>
              <Badge className="bg-amber-100 text-amber-800 border border-amber-300">{pendingAdjustments.length} Pending</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs font-black uppercase bg-zinc-50 text-zinc-500 border-b border-black">
                  <tr>
                    <th className="px-4 py-3">Request</th>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3 text-center">System vs Actual</th>
                    <th className="px-4 py-3 text-center">Discrepancy</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {pendingAdjustments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-zinc-400 font-bold italic">
                        No pending adjustments.
                      </td>
                    </tr>
                  ) : (
                    pendingAdjustments.map((req) => (
                      <tr key={req.taskId} className="hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <div className="font-bold text-xs">{req.warehouseCode} - {req.warehouseName}</div>
                          <div className="text-[11px] text-zinc-500">{new Date(req.createdAt).toLocaleString()}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold">{req.productName}</div>
                          <div className="text-xs text-zinc-500 font-mono">{req.productCode}</div>
                        </td>
                        <td className="px-4 py-3 text-center font-mono">{req.systemQty} / {req.actualQty}</td>
                        <td className={`px-4 py-3 text-center font-black ${req.discrepancy >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                          {req.discrepancy >= 0 ? `+${req.discrepancy}` : req.discrepancy}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canApprove ? (
                            <div className="inline-flex gap-2">
                              <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleApproveAdjustment(req.taskId)}>
                                Approve
                              </Button>
                              <Button size="sm" variant="destructive" className="h-8" onClick={() => handleRejectAdjustment(req.taskId)}>
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <Badge variant="outline">Waiting manager/boss approval</Badge>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-white rounded-xl overflow-hidden min-h-[500px]">
          <CardHeader className="bg-white border-b-2 border-black py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-xl font-black uppercase tracking-wide flex items-center gap-2">
              <Clock className="h-5 w-5" /> Log Hasil Opname
            </CardTitle>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input className="h-9 pl-8 w-[200px] border-2 border-black text-xs font-bold" placeholder="Filter hasil..." />
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
                    <tr><td colSpan={4} className="p-8 text-center text-zinc-500 font-bold">Memuat Data...</td></tr>
                  ) : auditLogs.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-zinc-400 font-bold italic">Belum ada data audit.</td></tr>
                  ) : auditLogs.map((log) => {
                    const diff = log.actualQty - log.systemQty;
                    return (
                      <tr key={log.id} className="hover:bg-yellow-50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-zinc-900 flex items-center gap-2">
                              <Clock className="h-3 w-3 text-zinc-400" />
                              {format(new Date(log.date), "HH:mm", { locale: id })}
                            </span>
                            <span className="text-xs font-bold text-muted-foreground">
                              {format(new Date(log.date), "dd MMM yyyy", { locale: id })}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-black text-base uppercase tracking-tight">{log.productName}</div>
                          <div className="text-xs font-bold text-muted-foreground mt-1 flex items-center gap-2">
                            <Warehouse className="h-3 w-3" /> {log.warehouse}
                          </div>
                          <Badge variant="secondary" className="mt-1 text-[10px] font-bold border border-zinc-200">{log.category}</Badge>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="font-mono font-bold">{log.actualQty} / {log.systemQty}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {log.status === "MATCH" ? (
                            <Badge className="bg-green-100 text-green-700 border-2 border-green-600 font-bold hover:bg-green-200">SESUAI</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 border-2 border-red-600 font-bold hover:bg-red-200 animate-pulse">
                              SELISIH {diff > 0 ? `+${diff}` : diff}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
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

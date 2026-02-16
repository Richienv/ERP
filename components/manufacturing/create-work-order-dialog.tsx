"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Factory, Package, CalendarDays, Cog, AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";

interface ProductOption {
  id: string;
  code: string;
  name: string;
  unit: string;
}

interface MachineOption {
  id: string;
  code: string;
  name: string;
  status: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => Promise<void> | void;
  orderType?: "MO" | "SPK";
}

export function CreateWorkOrderDialog({ open, onOpenChange, onCreated, orderType = "SPK" }: Props) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [productId, setProductId] = useState("");
  const [plannedQty, setPlannedQty] = useState("1");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [machineId, setMachineId] = useState("none");

  useEffect(() => {
    if (!open) return;

    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const [productRes, machineRes] = await Promise.all([
          fetch("/api/products?limit=500&status=active"),
          fetch("/api/manufacturing/machines"),
        ]);

        const productPayload = await productRes.json();
        const machinePayload = await machineRes.json();

        if (productPayload.success) {
          setProducts(
            (productPayload.data || []).map((p: any) => ({
              id: p.id,
              code: p.code,
              name: p.name,
              unit: p.unit,
            }))
          );
        }

        if (machinePayload.success) {
          setMachines(
            (machinePayload.data || []).map((m: any) => ({
              id: m.id,
              code: m.code,
              name: m.name,
              status: m.status,
            }))
          );
        }
      } catch (error) {
        console.error(error);
        toast.error("Gagal memuat opsi form", { className: "font-bold border-2 border-black rounded-none" });
      } finally {
        setLoadingOptions(false);
      }
    };

    loadOptions();
  }, [open]);

  const resetForm = () => {
    setProductId("");
    setPlannedQty("1");
    setStartDate("");
    setDueDate("");
    setPriority("NORMAL");
    setMachineId("none");
  };

  const handleSubmit = async () => {
    if (!productId || Number(plannedQty) <= 0) {
      toast.error("Produk dan jumlah rencana harus diisi", { className: "font-bold border-2 border-black rounded-none" });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/manufacturing/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType,
          productId,
          plannedQty: Number(plannedQty),
          startDate: startDate || undefined,
          dueDate: dueDate || undefined,
          priority,
          machineId: machineId === "none" ? undefined : machineId,
        }),
      });

      const payload = await response.json();
      if (!payload.success) {
        toast.error(payload.error || "Gagal membuat perintah kerja", { className: "font-bold border-2 border-black rounded-none" });
        return;
      }

      toast.success(`${orderType} ${payload.data?.number || "berhasil dibuat"}`, { className: "font-bold border-2 border-black rounded-none" });
      resetForm();
      onOpenChange(false);
      if (onCreated) await onCreated();
    } catch (error) {
      console.error(error);
      toast.error("Terjadi kesalahan jaringan", { className: "font-bold border-2 border-black rounded-none" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl overflow-hidden p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none gap-0 bg-white">
        {/* Header */}
        <div className="bg-black text-white px-6 pt-6 pb-4 shrink-0 border-b-2 border-black">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-3">
              <div className="h-10 w-10 bg-white text-black flex items-center justify-center border-2 border-white rounded-none">
                <Factory className="h-5 w-5" />
              </div>
              {orderType === "MO" ? "Buat Production Order (MO)" : "Buat Work Order (SPK)"}
            </DialogTitle>
            <p className="text-zinc-400 font-medium text-xs uppercase tracking-wide mt-2">
              {orderType === "MO"
                ? "MO fokus pada target produksi, planning date, dan alokasi kapasitas."
                : "SPK fokus pada eksekusi detail di lantai produksi dan penugasan mesin."}
            </p>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[70vh]">
          <div className="p-6 space-y-6">

            {/* Product Section */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="bg-blue-50 border-b-2 border-black p-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-900" />
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-900">Produk & Jumlah</span>
              </div>
              <div className="p-4 space-y-4 bg-white">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Finished Good Product <span className="text-red-500">*</span></Label>
                  <Select value={productId} onValueChange={setProductId} disabled={loadingOptions}>
                    <SelectTrigger className="border-2 border-black font-bold h-10 rounded-none focus:ring-0 focus:ring-offset-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                      <SelectValue placeholder="Pilih Produk" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none">
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id} className="font-medium cursor-pointer hover:bg-zinc-100 rounded-none">
                          <span className="font-mono text-[10px] text-zinc-400 mr-2 font-bold">{product.code}</span>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Planned Qty <span className="text-red-500">*</span></Label>
                    <Input
                      type="number"
                      min={1}
                      value={plannedQty}
                      onChange={(e) => setPlannedQty(e.target.value)}
                      className="border-2 border-black font-mono font-bold h-10 rounded-none focus-visible:ring-0 focus-visible:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Priority</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger className="border-2 border-black font-bold h-10 rounded-none focus:ring-0 focus:ring-offset-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none">
                        <SelectItem value="CRITICAL" className="font-black text-red-600 focus:bg-red-50 rounded-none">CRITICAL</SelectItem>
                        <SelectItem value="HIGH" className="font-bold text-amber-600 focus:bg-amber-50 rounded-none">HIGH</SelectItem>
                        <SelectItem value="NORMAL" className="font-medium focus:bg-zinc-100 rounded-none">NORMAL</SelectItem>
                        <SelectItem value="LOW" className="font-medium text-zinc-500 focus:bg-zinc-50 rounded-none">LOW</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Schedule Section */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="bg-amber-50 border-b-2 border-black p-3 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-amber-900" />
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-900">Jadwal Produksi</span>
              </div>
              <div className="p-4 space-y-4 bg-white">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Start Date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="border-2 border-black font-medium h-10 rounded-none focus-visible:ring-0 focus-visible:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Due Date</Label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="border-2 border-black font-medium h-10 rounded-none focus-visible:ring-0 focus-visible:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Machine Section */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="bg-zinc-50 border-b-2 border-black p-3 flex items-center gap-2">
                <Cog className="h-4 w-4 text-zinc-900" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-900">Alokasi Mesin</span>
              </div>
              <div className="p-4 space-y-4 bg-white">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Assign Machine (Optional)</Label>
                  <Select value={machineId} onValueChange={setMachineId}>
                    <SelectTrigger className="border-2 border-black font-bold h-10 rounded-none focus:ring-0 focus:ring-offset-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                      <SelectValue placeholder="Pilih Mesin" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none">
                      <SelectItem value="none" className="font-bold cursor-pointer hover:bg-zinc-100 rounded-none">Tidak Ada</SelectItem>
                      {machines
                        .filter((m) => m.status !== "OFFLINE")
                        .map((machine) => (
                          <SelectItem key={machine.id} value={machine.id} className="font-medium cursor-pointer hover:bg-zinc-100 rounded-none">
                            <span className="font-mono text-[10px] text-zinc-400 mr-2 font-bold">{machine.code}</span>
                            {machine.name} ({machine.status})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t-2 border-black bg-zinc-50 flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wide bg-white active:scale-[0.98] rounded-none h-10"
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button
            className="flex-1 bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] transition-all font-black uppercase text-xs tracking-wide active:scale-[0.98] rounded-none h-10 hover:bg-zinc-800"
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
              </>
            ) : (
              `Buat ${orderType}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

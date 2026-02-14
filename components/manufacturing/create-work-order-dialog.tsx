"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Factory, Package, CalendarDays, Cog } from "lucide-react";
import { NB } from "@/lib/dialog-styles";

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
        toast.error("Failed to load form options");
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
      toast.error("Product and planned quantity are required");
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
        toast.error(payload.error || "Failed to create work order");
        return;
      }

      toast.success(`${orderType} ${payload.data?.number || "created"} successfully`);
      resetForm();
      onOpenChange(false);
      if (onCreated) await onCreated();
    } catch (error) {
      console.error(error);
      toast.error("Network error while creating work order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={NB.content}>
        <DialogHeader className={NB.header}>
          <DialogTitle className={NB.title}>
            <Factory className="h-5 w-5" />
            {orderType === "MO" ? "Create Production Order (MO)" : "Create Work Instruction (SPK)"}
          </DialogTitle>
          <p className={NB.subtitle}>
            {orderType === "MO"
              ? "MO fokus pada target produksi, planning date, dan alokasi kapasitas."
              : "SPK fokus pada eksekusi detail di lantai produksi dan penugasan mesin."}
          </p>
        </DialogHeader>

        <ScrollArea className={NB.scroll}>
          <div className="p-5 space-y-4">
            {/* Product Selection */}
            <div className={NB.section}>
              <div className={`${NB.sectionHead} border-l-4 border-l-blue-400 bg-blue-50`}>
                <Package className="h-4 w-4" />
                <span className={NB.sectionTitle}>Produk & Jumlah</span>
              </div>
              <div className={NB.sectionBody}>
                <div>
                  <label className={NB.label}>Finished Good Product <span className={NB.labelRequired}>*</span></label>
                  <Select value={productId} onValueChange={setProductId} disabled={loadingOptions}>
                    <SelectTrigger className={NB.select}>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.code} - {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={NB.label}>Planned Qty <span className={NB.labelRequired}>*</span></label>
                    <Input type="number" min={1} value={plannedQty} onChange={(e) => setPlannedQty(e.target.value)} className={NB.inputMono} />
                  </div>
                  <div>
                    <label className={NB.label}>Priority</label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger className={NB.select}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CRITICAL">CRITICAL</SelectItem>
                        <SelectItem value="HIGH">HIGH</SelectItem>
                        <SelectItem value="NORMAL">NORMAL</SelectItem>
                        <SelectItem value="LOW">LOW</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Scheduling */}
            <div className={NB.section}>
              <div className={`${NB.sectionHead} border-l-4 border-l-blue-400 bg-blue-50`}>
                <CalendarDays className="h-4 w-4" />
                <span className={NB.sectionTitle}>Jadwal</span>
              </div>
              <div className={NB.sectionBody}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={NB.label}>Start Date</label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={NB.input} />
                  </div>
                  <div>
                    <label className={NB.label}>Due Date</label>
                    <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={NB.input} />
                  </div>
                </div>
              </div>
            </div>

            {/* Machine Assignment */}
            <div className={NB.section}>
              <div className={`${NB.sectionHead} border-l-4 border-l-blue-400 bg-blue-50`}>
                <Cog className="h-4 w-4" />
                <span className={NB.sectionTitle}>Mesin / Work Center</span>
              </div>
              <div className={NB.sectionBody}>
                <div>
                  <label className={NB.label}>Assign Machine (Optional)</label>
                  <Select value={machineId} onValueChange={setMachineId}>
                    <SelectTrigger className={NB.select}>
                      <SelectValue placeholder="Assign machine" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Machine</SelectItem>
                      {machines
                        .filter((m) => m.status !== "OFFLINE")
                        .map((machine) => (
                          <SelectItem key={machine.id} value={machine.id}>
                            {machine.code} - {machine.name} ({machine.status})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={NB.footer}>
              <Button variant="outline" className={NB.cancelBtn} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button className={NB.submitBtn} disabled={submitting} onClick={handleSubmit}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                  </>
                ) : (
                  `Create ${orderType}`
                )}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

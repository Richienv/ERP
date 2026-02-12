"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

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
      <DialogContent className="max-w-3xl p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        <DialogHeader className="px-6 py-5 border-b bg-white">
          <DialogTitle className="text-3xl font-black uppercase tracking-tight">
            {orderType === "MO" ? "Create Production Order (MO)" : "Create Work Instruction (SPK)"}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {orderType === "MO"
              ? "MO fokus pada target produksi, planning date, dan alokasi kapasitas."
              : "SPK fokus pada eksekusi detail di lantai produksi dan penugasan mesin."}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          <div className="rounded-xl border border-black/15 bg-zinc-50/50 p-4 space-y-3">
            <div className="space-y-1.5">
              <Label>Finished Good Product</Label>
              <Select value={productId} onValueChange={setProductId} disabled={loadingOptions}>
                <SelectTrigger>
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
              <div className="space-y-1.5">
                <Label>Planned Qty</Label>
                <Input type="number" min={1} value={plannedQty} onChange={(e) => setPlannedQty(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Machine / Work Center (Optional)</Label>
              <Select value={machineId} onValueChange={setMachineId}>
                <SelectTrigger>
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

        <div className="px-6 py-4 border-t bg-zinc-50 flex gap-2">
          <Button variant="outline" className="flex-1 border-black" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1 bg-black text-white hover:bg-zinc-800" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Creating..." : `Create ${orderType}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { Factory, Package, CalendarDays, Cog } from "lucide-react";
import {
  NBDialog,
  NBDialogHeader,
  NBDialogBody,
  NBDialogFooter,
  NBSection,
  NBSelect,
  NBInput,
} from "@/components/ui/nb-dialog";

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
  const queryClient = useQueryClient();
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
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.mfgDashboard.all });
      if (onCreated) await onCreated();
    } catch (error) {
      console.error(error);
      toast.error("Terjadi kesalahan jaringan", { className: "font-bold border-2 border-black rounded-none" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <NBDialog open={open} onOpenChange={onOpenChange}>
      <NBDialogHeader
        icon={Factory}
        title={orderType === "MO" ? "Buat Production Order (MO)" : "Buat Work Order (SPK)"}
        subtitle={orderType === "MO"
          ? "MO fokus pada target produksi, planning date, dan alokasi kapasitas."
          : "SPK fokus pada eksekusi detail di lantai produksi dan penugasan mesin."}
      />

      <NBDialogBody>
        <NBSection icon={Package} title="Produk & Jumlah">
          <NBSelect
            label="Finished Good Product"
            required
            value={productId}
            onValueChange={setProductId}
            placeholder="Pilih Produk"
            disabled={loadingOptions}
          >
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                <span className="font-mono text-[10px] text-zinc-400 mr-2 font-bold">{product.code}</span>
                {product.name}
              </SelectItem>
            ))}
          </NBSelect>

          <div className="grid grid-cols-2 gap-3">
            <NBInput
              label="Planned Qty"
              required
              type="number"
              value={plannedQty}
              onChange={setPlannedQty}
            />
            <NBSelect
              label="Priority"
              value={priority}
              onValueChange={setPriority}
              options={[
                { value: "CRITICAL", label: "CRITICAL" },
                { value: "HIGH", label: "HIGH" },
                { value: "NORMAL", label: "NORMAL" },
                { value: "LOW", label: "LOW" },
              ]}
            />
          </div>
        </NBSection>

        <NBSection icon={CalendarDays} title="Jadwal Produksi" optional>
          <div className="grid grid-cols-2 gap-3">
            <NBInput
              label="Start Date"
              type="date"
              value={startDate}
              onChange={setStartDate}
            />
            <NBInput
              label="Due Date"
              type="date"
              value={dueDate}
              onChange={setDueDate}
            />
          </div>
        </NBSection>

        <NBSection icon={Cog} title="Alokasi Mesin" optional>
          <NBSelect
            label="Assign Machine"
            value={machineId}
            onValueChange={setMachineId}
            placeholder="Pilih Mesin"
          >
            <SelectItem value="none">Tidak Ada</SelectItem>
            {machines
              .filter((m) => m.status !== "OFFLINE")
              .map((machine) => (
                <SelectItem key={machine.id} value={machine.id}>
                  <span className="font-mono text-[10px] text-zinc-400 mr-2 font-bold">{machine.code}</span>
                  {machine.name} ({machine.status})
                </SelectItem>
              ))}
          </NBSelect>
        </NBSection>
      </NBDialogBody>

      <NBDialogFooter
        onCancel={() => onOpenChange(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={`Buat ${orderType}`}
      />
    </NBDialog>
  );
}

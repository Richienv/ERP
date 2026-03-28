"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Cog, Package } from "lucide-react";
import {
  NBDialog,
  NBDialogHeader,
  NBDialogBody,
  NBDialogFooter,
  NBSection,
  NBInput,
  NBTextarea,
  NBSelect,
} from "@/components/ui/nb-dialog";

interface MachineOption {
  id: string;
  code: string;
  name: string;
}

interface ProductOption {
  id: string;
  code: string;
  name: string;
  unit: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routingId: string;
  routingName: string;
  nextSequence?: number;
  onSaved?: () => Promise<void> | void;
}

export function AddRoutingStepDialog({ open, onOpenChange, routingId, routingName, nextSequence = 1, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [materials, setMaterials] = useState<ProductOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [sequence, setSequence] = useState(String(nextSequence));
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [machineId, setMachineId] = useState("none");
  const [materialId, setMaterialId] = useState("none");
  const [materialQty, setMaterialQty] = useState("");
  const [materialUnit, setMaterialUnit] = useState("");

  const selectedMaterial = useMemo(() => materials.find((m) => m.id === materialId), [materials, materialId]);

  useEffect(() => {
    if (!open) return;

    setSequence(String(nextSequence));
    setName("");
    setDescription("");
    setDurationMinutes("30");
    setMachineId("none");
    setMaterialId("none");
    setMaterialQty("");
    setMaterialUnit("");

    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const [machineResponse, materialResponse] = await Promise.all([
          fetch("/api/manufacturing/machines"),
          fetch("/api/products?limit=500&status=active"),
        ]);

        const machinePayload = await machineResponse.json();
        const materialPayload = await materialResponse.json();

        if (machinePayload.success) {
          setMachines(
            (machinePayload.data || []).map((machine: any) => ({
              id: machine.id,
              code: machine.code,
              name: machine.name,
            }))
          );
        }

        if (materialPayload.success) {
          setMaterials(
            (materialPayload.data || []).map((product: any) => ({
              id: product.id,
              code: product.code,
              name: product.name,
              unit: product.unit,
            }))
          );
        }
      } catch (error) {
        console.error(error);
        toast.error("Gagal mendapatkan data mesin/material", { className: "font-bold border-2 border-black rounded-none" });
      } finally {
        setLoadingOptions(false);
      }
    };

    loadOptions();
  }, [open, nextSequence]);

  useEffect(() => {
    if (selectedMaterial) {
      setMaterialUnit(selectedMaterial.unit || "");
    }
  }, [selectedMaterial]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Nama step harus diisi", { className: "font-bold border-2 border-black rounded-none" });
      return;
    }

    const duration = Number(durationMinutes || 0);
    if (!Number.isFinite(duration) || duration <= 0) {
      toast.error("Durasi harus lebih dari 0", { className: "font-bold border-2 border-black rounded-none" });
      return;
    }

    if (materialId !== "none" && (!materialQty || Number(materialQty) <= 0)) {
      toast.error("Quantity material harus diisi", { className: "font-bold border-2 border-black rounded-none" });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/manufacturing/routing/${routingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_STEP",
          sequence: Number(sequence || nextSequence),
          name: name.trim(),
          description: description.trim() || undefined,
          durationMinutes: duration,
          machineId: machineId === "none" ? null : machineId,
          materialId: materialId === "none" ? null : materialId,
          materialQty: materialId === "none" ? null : Number(materialQty),
          materialUnit: materialId === "none" ? null : materialUnit || selectedMaterial?.unit || null,
        }),
      });

      const payload = await response.json();
      if (!payload.success) {
        toast.error(payload.error || "Gagal menambah routing step", { className: "font-bold border-2 border-black rounded-none" });
        return;
      }

      toast.success("Routing step berhasil ditambahkan", { className: "font-bold border-2 border-black rounded-none" });
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.mfgRouting.all });
      if (onSaved) await onSaved();
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
        icon={Plus}
        title="Tambah Step Proses"
        subtitle={`Routing: ${routingName}`}
      />

      <NBDialogBody>
        <NBSection icon={Cog} title="Detail Langkah">
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <NBInput
              label="Urutan"
              type="number"
              value={sequence}
              onChange={setSequence}
            />
            <NBInput
              label="Nama Step"
              required
              value={name}
              onChange={setName}
              placeholder="Contoh: Cutting / Sewing / Finishing"
            />
          </div>

          <NBTextarea
            label="Deskripsi"
            value={description}
            onChange={setDescription}
            placeholder="Instruksi pengerjaan..."
            rows={2}
          />

          <div className="grid grid-cols-2 gap-3">
            <NBInput
              label="Durasi (Menit)"
              required
              type="number"
              value={durationMinutes}
              onChange={setDurationMinutes}
            />
            <NBSelect
              label="Mesin"
              value={machineId}
              onValueChange={setMachineId}
              placeholder="Pilih Mesin"
              disabled={loadingOptions}
            >
              <SelectItem value="none">Tidak Ada</SelectItem>
              {machines.map((machine) => (
                <SelectItem key={machine.id} value={machine.id}>
                  <span className="font-mono text-[10px] text-zinc-400 mr-2 font-bold">{machine.code}</span>
                  {machine.name}
                </SelectItem>
              ))}
            </NBSelect>
          </div>
        </NBSection>

        <NBSection icon={Package} title="Material Requirement" optional>
          <div className="grid grid-cols-[1fr_80px_80px] gap-3">
            <NBSelect
              label="Material"
              value={materialId}
              onValueChange={setMaterialId}
              placeholder="Pilih Material"
              disabled={loadingOptions}
            >
              <SelectItem value="none">Tidak Ada</SelectItem>
              {materials.map((material) => (
                <SelectItem key={material.id} value={material.id}>
                  <span className="font-mono text-[10px] text-zinc-400 mr-2 font-bold">{material.code}</span>
                  {material.name}
                </SelectItem>
              ))}
            </NBSelect>
            <NBInput
              label="Qty"
              type="number"
              value={materialQty}
              onChange={setMaterialQty}
              disabled={materialId === "none"}
            />
            <NBInput
              label="Unit"
              value={materialUnit || "-"}
              onChange={() => {}}
              disabled
            />
          </div>
        </NBSection>
      </NBDialogBody>

      <NBDialogFooter
        onCancel={() => onOpenChange(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel="Tambah Step"
      />
    </NBDialog>
  );
}

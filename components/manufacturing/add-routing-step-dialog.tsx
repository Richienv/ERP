"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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
        toast.error("Failed to load routing step options");
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
      toast.error("Step name is required");
      return;
    }

    const duration = Number(durationMinutes || 0);
    if (!Number.isFinite(duration) || duration <= 0) {
      toast.error("Duration must be greater than 0");
      return;
    }

    if (materialId !== "none" && (!materialQty || Number(materialQty) <= 0)) {
      toast.error("Material quantity is required when material is selected");
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
          materialUnit: materialId === "none" ? null : (materialUnit || selectedMaterial?.unit || null),
        }),
      });

      const payload = await response.json();
      if (!payload.success) {
        toast.error(payload.error || "Failed to add routing step");
        return;
      }

      toast.success("Routing step added");
      onOpenChange(false);
      if (onSaved) await onSaved();
    } catch (error) {
      console.error(error);
      toast.error("Network error while adding step");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        <DialogHeader className="px-6 py-5 border-b bg-white">
          <DialogTitle className="text-3xl font-black uppercase tracking-tight">Add Routing Step</DialogTitle>
          <DialogDescription className="text-sm">
            Create step for <span className="font-semibold text-black">{routingName}</span> with machine and material dependency.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[72vh] overflow-y-auto px-6 py-5 space-y-4">
          <div className="rounded-xl border border-black/15 bg-zinc-50/50 p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Sequence</Label>
                <Input type="number" min={1} value={sequence} onChange={(e) => setSequence(e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Step Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cutting / Sewing / Finishing" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Step-level instructions" className="min-h-[86px]" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Duration (Minutes)</Label>
                <Input type="number" min={1} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Machine</Label>
                <Select value={machineId} onValueChange={setMachineId} disabled={loadingOptions}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select machine" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Machine</SelectItem>
                    {machines.map((machine) => (
                      <SelectItem key={machine.id} value={machine.id}>
                        {machine.code} - {machine.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-black/20 p-4 space-y-3 bg-white">
            <p className="text-sm font-black uppercase tracking-wide">Material Requirement (Optional)</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Material</Label>
                <Select value={materialId} onValueChange={setMaterialId} disabled={loadingOptions}>
                  <SelectTrigger>
                    <SelectValue placeholder="No Material" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Material</SelectItem>
                    {materials.map((material) => (
                      <SelectItem key={material.id} value={material.id}>
                        {material.code} - {material.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Material Qty</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.001"
                  value={materialQty}
                  onChange={(e) => setMaterialQty(e.target.value)}
                  disabled={materialId === "none"}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Material Unit</Label>
                <Input value={materialUnit || "-"} readOnly className="bg-zinc-100" disabled={materialId === "none"} />
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-zinc-50 flex gap-2">
          <Button variant="outline" className="flex-1 border-black" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1 bg-black text-white hover:bg-zinc-800" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Saving..." : "Add Step"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

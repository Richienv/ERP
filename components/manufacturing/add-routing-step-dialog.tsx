"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Route, Cog, Package } from "lucide-react";
import { NB } from "@/lib/dialog-styles";

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
          materialUnit: materialId === "none" ? null : materialUnit || selectedMaterial?.unit || null,
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
      <DialogContent className={NB.contentWide}>
        <DialogHeader className={NB.header}>
          <DialogTitle className={NB.title}>
            <Route className="h-5 w-5" /> Add Routing Step
          </DialogTitle>
          <p className={NB.subtitle}>
            Tambah step untuk <span className="text-white font-black">{routingName}</span>
          </p>
        </DialogHeader>

        <ScrollArea className={NB.scroll}>
          <div className="p-5 space-y-4">
            {/* Step Details */}
            <div className={NB.section}>
              <div className={`${NB.sectionHead} border-l-4 border-l-blue-400 bg-blue-50`}>
                <Route className="h-4 w-4" />
                <span className={NB.sectionTitle}>Detail Step</span>
              </div>
              <div className={NB.sectionBody}>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={NB.label}>Sequence <span className={NB.labelRequired}>*</span></label>
                    <Input type="number" min={1} value={sequence} onChange={(e) => setSequence(e.target.value)} className={NB.inputMono} />
                  </div>
                  <div className="col-span-2">
                    <label className={NB.label}>Step Name <span className={NB.labelRequired}>*</span></label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cutting / Sewing / Finishing" className={NB.input} />
                  </div>
                </div>
                <div>
                  <label className={NB.label}>Description</label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Step-level instructions" className={NB.textarea + " min-h-[80px]"} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={NB.label}>Duration (Minutes) <span className={NB.labelRequired}>*</span></label>
                    <Input type="number" min={1} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} className={NB.inputMono} />
                  </div>
                  <div>
                    <label className={NB.label}>Machine</label>
                    <Select value={machineId} onValueChange={setMachineId} disabled={loadingOptions}>
                      <SelectTrigger className={NB.select}>
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
            </div>

            {/* Material Requirement */}
            <div className={NB.section}>
              <div className={`${NB.sectionHead} border-l-4 border-l-blue-400 bg-blue-50`}>
                <Package className="h-4 w-4" />
                <span className={NB.sectionTitle}>Material Requirement (Optional)</span>
              </div>
              <div className={NB.sectionBody}>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={NB.label}>Material</label>
                    <Select value={materialId} onValueChange={setMaterialId} disabled={loadingOptions}>
                      <SelectTrigger className={NB.select}>
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
                  <div>
                    <label className={NB.label}>Material Qty</label>
                    <Input
                      type="number"
                      min={0}
                      step="0.001"
                      value={materialQty}
                      onChange={(e) => setMaterialQty(e.target.value)}
                      disabled={materialId === "none"}
                      className={NB.inputMono}
                    />
                  </div>
                  <div>
                    <label className={NB.label}>Material Unit</label>
                    <Input value={materialUnit || "-"} readOnly className={NB.inputMono + " bg-zinc-100"} disabled={materialId === "none"} />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={NB.footer}>
              <Button variant="outline" className={NB.cancelBtn} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button className={NB.submitBtn} disabled={submitting} onClick={handleSubmit}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Add Step"}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

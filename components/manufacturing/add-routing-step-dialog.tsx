"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Route, Cog, Package, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

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
      if (onSaved) await onSaved();
    } catch (error) {
      console.error(error);
      toast.error("Terjadi kesalahan jaringan", { className: "font-bold border-2 border-black rounded-none" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl lg:max-w-3xl overflow-hidden p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none gap-0 bg-white">

        {/* Header */}
        <div className="bg-black text-white px-6 pt-6 pb-4 shrink-0 border-b-2 border-black">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-3">
              <div className="h-10 w-10 bg-white text-black flex items-center justify-center border-2 border-white rounded-none">
                <Plus className="h-5 w-5" />
              </div>
              Tambah Step Proses
            </DialogTitle>
            <p className="text-zinc-400 font-medium text-xs uppercase tracking-wide mt-2">
              Routing: <span className="text-white font-black">{routingName}</span>
            </p>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[70vh]">
          <div className="p-6 space-y-6">

            {/* Step Detail Card */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="bg-blue-50 border-b-2 border-black p-3 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-none transform rotate-45" />
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-900">Detail Langkah</span>
              </div>
              <div className="p-4 space-y-4 bg-white">
                <div className="grid grid-cols-[80px_1fr] gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Urutan</Label>
                    <Input
                      type="number"
                      min={1}
                      value={sequence}
                      onChange={(e) => setSequence(e.target.value)}
                      className="border-2 border-black font-mono font-bold h-10 rounded-none text-center bg-zinc-50 focus-visible:ring-0 focus-visible:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nama Step</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Contoh: Cutting / Sewing / Finishing"
                      className="border-2 border-black font-bold h-10 rounded-none focus-visible:ring-0 focus-visible:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Deskripsi</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Instruksi pengerjaan..."
                    className="border-2 border-black font-medium min-h-[60px] rounded-none focus-visible:ring-0 focus-visible:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Durasi (Menit)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(e.target.value)}
                      className="border-2 border-black font-mono font-bold h-10 rounded-none focus-visible:ring-0 focus-visible:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Mesin (Opsional)</Label>
                    <Select value={machineId} onValueChange={setMachineId} disabled={loadingOptions}>
                      <SelectTrigger className="border-2 border-black font-bold h-10 rounded-none focus:ring-0 focus:ring-offset-0 focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                        <SelectValue placeholder="Pilih Mesin" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none">
                        <SelectItem value="none" className="font-bold cursor-pointer hover:bg-zinc-100 rounded-none">Tidak Ada</SelectItem>
                        {machines.map((machine) => (
                          <SelectItem key={machine.id} value={machine.id} className="font-medium cursor-pointer hover:bg-zinc-100 rounded-none">
                            <span className="font-mono text-[10px] text-zinc-400 mr-2 font-bold">{machine.code}</span>
                            {machine.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Material Req Card */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="bg-amber-50 border-b-2 border-black p-3 flex items-center gap-2">
                <div className="w-2 h-2 bg-amber-500 rounded-none transform rotate-45" />
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-900">Material Requirement (Opsional)</span>
              </div>
              <div className="p-4 space-y-4 bg-white">
                <div className="grid grid-cols-[1fr_80px_80px] gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Material</Label>
                    <Select value={materialId} onValueChange={setMaterialId} disabled={loadingOptions}>
                      <SelectTrigger className="border-2 border-black font-bold h-10 rounded-none focus:ring-0 focus:ring-offset-0 focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                        <SelectValue placeholder="Pilih Material" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none">
                        <SelectItem value="none" className="font-bold cursor-pointer hover:bg-zinc-100 rounded-none">Tidak Ada</SelectItem>
                        {materials.map((material) => (
                          <SelectItem key={material.id} value={material.id} className="font-medium cursor-pointer hover:bg-zinc-100 rounded-none">
                            <span className="font-mono text-[10px] text-zinc-400 mr-2 font-bold">{material.code}</span>
                            {material.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Qty</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.001"
                      value={materialQty}
                      onChange={(e) => setMaterialQty(e.target.value)}
                      disabled={materialId === "none"}
                      className="border-2 border-black font-mono font-bold h-10 rounded-none text-center bg-zinc-50 focus-visible:ring-0 focus-visible:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Unit</Label>
                    <Input
                      value={materialUnit || "-"}
                      readOnly
                      className="border-2 border-black font-mono font-bold h-10 rounded-none text-center bg-zinc-100 text-zinc-500"
                    />
                  </div>
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
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : "Tambah Step"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

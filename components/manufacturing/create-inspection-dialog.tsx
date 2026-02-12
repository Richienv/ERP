"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface InspectorOption {
  id: string;
  firstName: string;
  lastName?: string;
}

interface ProductOption {
  id: string;
  code: string;
  name: string;
}

interface WorkOrderOption {
  id: string;
  number: string;
}

interface DefectLine {
  type: string;
  description: string;
  actionTaken: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => Promise<void> | void;
}

const makeDefaultBatch = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `BATCH-${y}${m}${d}-${h}${min}`;
};

export function CreateInspectionDialog({ open, onOpenChange, onCreated }: Props) {
  const [materials, setMaterials] = useState<ProductOption[]>([]);
  const [inspectors, setInspectors] = useState<InspectorOption[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [batchNumber, setBatchNumber] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [inspectorId, setInspectorId] = useState("");
  const [workOrderId, setWorkOrderId] = useState("none");
  const [status, setStatus] = useState("PASS");
  const [score, setScore] = useState("100");
  const [notes, setNotes] = useState("");
  const [defects, setDefects] = useState<DefectLine[]>([]);

  useEffect(() => {
    if (!open) return;

    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const response = await fetch("/api/manufacturing/quality?limit=1");
        const payload = await response.json();

        if (payload.success) {
          const options = payload.options || {};
          setMaterials(options.materials || []);
          setInspectors(options.inspectors || []);
          setWorkOrders(options.workOrders || []);
        }
      } catch (error) {
        console.error(error);
        toast.error("Failed to load quality options");
      } finally {
        setLoadingOptions(false);
      }
    };

    setBatchNumber(makeDefaultBatch());
    setMaterialId("");
    setInspectorId("");
    setWorkOrderId("none");
    setStatus("PASS");
    setScore("100");
    setNotes("");
    setDefects([]);

    loadOptions();
  }, [open]);

  const selectedStatusTone = useMemo(() => {
    if (status === "PASS") return "bg-emerald-50 border-emerald-200";
    if (status === "CONDITIONAL") return "bg-amber-50 border-amber-200";
    return "bg-red-50 border-red-200";
  }, [status]);

  const updateDefect = (index: number, patch: Partial<DefectLine>) => {
    setDefects((prev) => prev.map((defect, i) => (i === index ? { ...defect, ...patch } : defect)));
  };

  const addDefect = () => {
    setDefects((prev) => [...prev, { type: "MINOR", description: "", actionTaken: "REWORK" }]);
  };

  const removeDefect = (index: number) => {
    setDefects((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!batchNumber.trim() || !materialId || !inspectorId) {
      toast.error("Batch number, material, and inspector are required");
      return;
    }

    const numericScore = Number(score || 0);
    if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100) {
      toast.error("Score must be between 0 and 100");
      return;
    }

    const cleanedDefects = defects
      .map((defect) => ({
        type: defect.type,
        description: defect.description.trim(),
        actionTaken: defect.actionTaken,
      }))
      .filter((defect) => defect.description.length > 0);

    setSubmitting(true);
    try {
      const response = await fetch("/api/manufacturing/quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchNumber: batchNumber.trim(),
          materialId,
          inspectorId,
          workOrderId: workOrderId === "none" ? null : workOrderId,
          status,
          score: numericScore,
          notes: notes.trim() || null,
          defects: cleanedDefects,
        }),
      });

      const payload = await response.json();
      if (!payload.success) {
        toast.error(payload.error || "Failed to create inspection");
        return;
      }

      toast.success("Inspection created");
      onOpenChange(false);
      if (onCreated) await onCreated();
    } catch (error) {
      console.error(error);
      toast.error("Network error while creating inspection");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        <DialogHeader className="px-6 py-5 border-b bg-white">
          <DialogTitle className="text-3xl font-black uppercase tracking-tight">Create Quality Inspection</DialogTitle>
          <DialogDescription className="text-sm">Core quality form with option-based selection to reduce data mismatch.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[72vh] overflow-y-auto px-6 py-5 space-y-4">
          <div className={`rounded-xl border p-4 space-y-3 ${selectedStatusTone}`}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Batch Number</Label>
                <Input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Result Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PASS">PASS</SelectItem>
                    <SelectItem value="CONDITIONAL">CONDITIONAL</SelectItem>
                    <SelectItem value="FAIL">FAIL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Material/Product</Label>
                <Select value={materialId} onValueChange={setMaterialId} disabled={loadingOptions}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((material) => (
                      <SelectItem key={material.id} value={material.id}>
                        {material.code} - {material.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Inspector</Label>
                <Select value={inspectorId} onValueChange={setInspectorId} disabled={loadingOptions}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select inspector" />
                  </SelectTrigger>
                  <SelectContent>
                    {inspectors.map((inspector) => (
                      <SelectItem key={inspector.id} value={inspector.id}>
                        {inspector.firstName} {inspector.lastName || ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Related Work Order</Label>
                <Select value={workOrderId} onValueChange={setWorkOrderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Work Order</SelectItem>
                    {workOrders.map((workOrder) => (
                      <SelectItem key={workOrder.id} value={workOrder.id}>
                        {workOrder.number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Score (%)</Label>
                <Input type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[42px]" placeholder="Optional inspector notes" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-black/20 p-4 space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black uppercase tracking-wide">Defects (Optional)</p>
              <Button type="button" size="sm" variant="outline" className="border-black" onClick={addDefect}>
                <Plus className="h-4 w-4 mr-1" /> Add Defect
              </Button>
            </div>

            {defects.length === 0 && <p className="text-xs text-muted-foreground">No defect lines added.</p>}

            {defects.map((defect, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-2 space-y-1.5">
                  <Label>Type</Label>
                  <Select value={defect.type} onValueChange={(value) => updateDefect(index, { type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CRITICAL">CRITICAL</SelectItem>
                      <SelectItem value="MAJOR">MAJOR</SelectItem>
                      <SelectItem value="MINOR">MINOR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-6 space-y-1.5">
                  <Label>Description</Label>
                  <Input value={defect.description} onChange={(e) => updateDefect(index, { description: e.target.value })} placeholder="Describe defect" />
                </div>
                <div className="col-span-3 space-y-1.5">
                  <Label>Action</Label>
                  <Select value={defect.actionTaken} onValueChange={(value) => updateDefect(index, { actionTaken: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REWORK">REWORK</SelectItem>
                      <SelectItem value="SCRAP">SCRAP</SelectItem>
                      <SelectItem value="ACCEPT_CONCESSION">ACCEPT_CONCESSION</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-1">
                  <Button type="button" variant="outline" size="icon" className="border-red-300 text-red-600" onClick={() => removeDefect(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-zinc-50 flex gap-2">
          <Button variant="outline" className="flex-1 border-black" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1 bg-black text-white hover:bg-zinc-800" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Creating..." : "Create Inspection"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

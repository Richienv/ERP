"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Loader2, ClipboardCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { NB } from "@/lib/dialog-styles";

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
    if (status === "PASS") return "border-l-emerald-400 bg-emerald-50";
    if (status === "CONDITIONAL") return "border-l-amber-400 bg-amber-50";
    return "border-l-red-400 bg-red-50";
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
      <DialogContent className={NB.contentWide}>
        <DialogHeader className={NB.header}>
          <DialogTitle className={NB.title}>
            <ClipboardCheck className="h-5 w-5" /> Create Quality Inspection
          </DialogTitle>
          <p className={NB.subtitle}>Core quality form with option-based selection</p>
        </DialogHeader>

        <ScrollArea className={NB.scroll}>
          <div className="p-5 space-y-4">
            {/* Inspection Details */}
            <div className={NB.section}>
              <div className={`${NB.sectionHead} border-l-4 ${selectedStatusTone}`}>
                <ClipboardCheck className="h-4 w-4" />
                <span className={NB.sectionTitle}>Detail Inspeksi</span>
              </div>
              <div className={NB.sectionBody}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={NB.label}>Batch Number <span className={NB.labelRequired}>*</span></label>
                    <Input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} className={NB.inputMono} />
                  </div>
                  <div>
                    <label className={NB.label}>Result Status <span className={NB.labelRequired}>*</span></label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger className={NB.select}>
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
                  <div>
                    <label className={NB.label}>Material/Product <span className={NB.labelRequired}>*</span></label>
                    <Select value={materialId} onValueChange={setMaterialId} disabled={loadingOptions}>
                      <SelectTrigger className={NB.select}>
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
                  <div>
                    <label className={NB.label}>Inspector <span className={NB.labelRequired}>*</span></label>
                    <Select value={inspectorId} onValueChange={setInspectorId} disabled={loadingOptions}>
                      <SelectTrigger className={NB.select}>
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
                  <div>
                    <label className={NB.label}>Related Work Order</label>
                    <Select value={workOrderId} onValueChange={setWorkOrderId}>
                      <SelectTrigger className={NB.select}>
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
                  <div>
                    <label className={NB.label}>Score (%)</label>
                    <Input type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} className={NB.inputMono} />
                  </div>
                  <div>
                    <label className={NB.label}>Notes</label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={NB.textarea + " min-h-[40px]"} placeholder="Optional inspector notes" />
                  </div>
                </div>
              </div>
            </div>

            {/* Defects */}
            <div className={NB.section}>
              <div className={`${NB.sectionHead} border-l-4 border-l-blue-400 bg-blue-50`}>
                <AlertTriangle className="h-4 w-4" />
                <span className={NB.sectionTitle}>Defects (Optional)</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="ml-auto h-7 text-[10px] font-black uppercase tracking-wider border-2 border-black"
                  onClick={addDefect}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Defect
                </Button>
              </div>
              <div className={NB.sectionBody}>
                {defects.length === 0 && <p className="text-xs text-zinc-400 font-bold">No defect lines added.</p>}

                {defects.map((defect, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-2">
                      <label className={NB.label}>Type</label>
                      <Select value={defect.type} onValueChange={(value) => updateDefect(index, { type: value })}>
                        <SelectTrigger className={NB.select}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CRITICAL">CRITICAL</SelectItem>
                          <SelectItem value="MAJOR">MAJOR</SelectItem>
                          <SelectItem value="MINOR">MINOR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-6">
                      <label className={NB.label}>Description</label>
                      <Input value={defect.description} onChange={(e) => updateDefect(index, { description: e.target.value })} placeholder="Describe defect" className={NB.input} />
                    </div>
                    <div className="col-span-3">
                      <label className={NB.label}>Action</label>
                      <Select value={defect.actionTaken} onValueChange={(value) => updateDefect(index, { actionTaken: value })}>
                        <SelectTrigger className={NB.select}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="REWORK">REWORK</SelectItem>
                          <SelectItem value="SCRAP">SCRAP</SelectItem>
                          <SelectItem value="ACCEPT_CONCESSION">ACCEPT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1">
                      <Button type="button" variant="outline" size="icon" className="border-2 border-red-300 text-red-600 h-10 w-10" onClick={() => removeDefect(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className={NB.footer}>
              <Button variant="outline" className={NB.cancelBtn} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button className={NB.submitBtn} disabled={submitting} onClick={handleSubmit}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : "Create Inspection"}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

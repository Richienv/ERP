"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ClipboardCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  NBDialog,
  NBDialogHeader,
  NBDialogBody,
  NBDialogFooter,
  NBSection,
  NBInput,
  NBSelect,
  NBTextarea,
} from "@/components/ui/nb-dialog";

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
  /**
   * @deprecated Inspector is now derived from the logged-in user's Employee
   * record on the server. This prop is kept for backward compatibility but
   * its value is ignored — the dropdown has been removed from the UI.
   * Sibling fix to commit 8540f70.
   */
  inspectors?: InspectorOption[];
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
  const queryClient = useQueryClient();
  const [materials, setMaterials] = useState<ProductOption[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [batchNumber, setBatchNumber] = useState("");
  const [materialId, setMaterialId] = useState("");
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
    setWorkOrderId("none");
    setStatus("PASS");
    setScore("100");
    setNotes("");
    setDefects([]);

    loadOptions();
  }, [open]);

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
    if (!batchNumber.trim() || !materialId) {
      toast.error("Batch number and material are required");
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
      // SECURITY: inspectorId is NOT sent — the server derives it from the
      // authenticated user's Employee record to prevent QC sign-off spoofing.
      const response = await fetch("/api/manufacturing/quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchNumber: batchNumber.trim(),
          materialId,
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
      queryClient.invalidateQueries({ queryKey: queryKeys.mfgQuality.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.mfgDashboard.all });
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
    <NBDialog open={open} onOpenChange={onOpenChange} size="wide">
      <NBDialogHeader
        icon={ClipboardCheck}
        title="Create Quality Inspection"
        subtitle="Core quality form with option-based selection"
      />

      <NBDialogBody>
        <NBSection icon={ClipboardCheck} title="Detail Inspeksi">
          <div className="grid grid-cols-2 gap-3">
            <NBInput
              label="Batch Number"
              required
              value={batchNumber}
              onChange={setBatchNumber}
            />
            <NBSelect
              label="Result Status"
              required
              value={status}
              onValueChange={setStatus}
              options={[
                { value: "PASS", label: "PASS" },
                { value: "CONDITIONAL", label: "CONDITIONAL" },
                { value: "FAIL", label: "FAIL" },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NBSelect
              label="Material/Product"
              required
              value={materialId}
              onValueChange={setMaterialId}
              placeholder="Select product"
              disabled={loadingOptions}
            >
              {materials.map((material) => (
                <SelectItem key={material.id} value={material.id}>
                  {material.code} - {material.name}
                </SelectItem>
              ))}
            </NBSelect>
            <NBSelect
              label="Related Work Order"
              value={workOrderId}
              onValueChange={setWorkOrderId}
              placeholder="Optional"
            >
              <SelectItem value="none">No Work Order</SelectItem>
              {workOrders.map((workOrder) => (
                <SelectItem key={workOrder.id} value={workOrder.id}>
                  {workOrder.number}
                </SelectItem>
              ))}
            </NBSelect>
          </div>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">
            Inspektor: otomatis tercatat dari akun yang login
          </p>

          <div className="grid grid-cols-2 gap-3">
            <NBInput
              label="Score (%)"
              type="number"
              value={score}
              onChange={setScore}
            />
            <NBTextarea
              label="Notes"
              value={notes}
              onChange={setNotes}
              placeholder="Optional inspector notes"
              rows={2}
            />
          </div>
        </NBSection>

        {/* Defects - complex table stays as-is */}
        <NBSection icon={AlertTriangle} title="Defects" optional>
          <div className="flex items-center justify-end -mt-1 mb-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-[10px] font-black uppercase tracking-wider border border-zinc-300 rounded-none"
              onClick={addDefect}
            >
              <Plus className="h-3 w-3 mr-1" /> Add Defect
            </Button>
          </div>

          {defects.length === 0 && <p className="text-xs text-zinc-400 font-bold">No defect lines added.</p>}

          {defects.map((defect, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1 block">Type</label>
                <Select value={defect.type} onValueChange={(value) => updateDefect(index, { type: value })}>
                  <SelectTrigger className="h-8 text-sm rounded-none border border-zinc-300">
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
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1 block">Description</label>
                <Input value={defect.description} onChange={(e) => updateDefect(index, { description: e.target.value })} placeholder="Describe defect" className="h-8 text-sm rounded-none border border-zinc-300" />
              </div>
              <div className="col-span-3">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1 block">Action</label>
                <Select value={defect.actionTaken} onValueChange={(value) => updateDefect(index, { actionTaken: value })}>
                  <SelectTrigger className="h-8 text-sm rounded-none border border-zinc-300">
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
                <Button type="button" variant="outline" size="icon" className="border border-red-300 text-red-600 h-8 w-8 rounded-none" onClick={() => removeDefect(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </NBSection>
      </NBDialogBody>

      <NBDialogFooter
        onCancel={() => onOpenChange(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel="Create Inspection"
      />
    </NBDialog>
  );
}

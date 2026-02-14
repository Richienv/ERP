"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Cog, Activity, Settings2 } from "lucide-react";
import { NB } from "@/lib/dialog-styles";

interface GroupOption {
  id: string;
  code: string;
  name: string;
}

interface MachineFormData {
  id?: string;
  code?: string;
  name?: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  groupId?: string | null;
  status?: string;
  healthScore?: number;
  capacityPerHour?: number | null;
  standardHoursPerDay?: number;
  overheadTimePerHour?: number;
  overheadMaterialCostPerHour?: number;
  lastMaintenance?: string | null;
  nextMaintenance?: string | null;
  isActive?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: MachineFormData | null;
  onSaved?: () => Promise<void> | void;
}

export function MachineFormDialog({ open, onOpenChange, initialData, onSaved }: Props) {
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [groupId, setGroupId] = useState("none");
  const [status, setStatus] = useState("IDLE");
  const [healthScore, setHealthScore] = useState("100");
  const [capacityPerHour, setCapacityPerHour] = useState("");
  const [standardHoursPerDay, setStandardHoursPerDay] = useState("8");
  const [overheadTimePerHour, setOverheadTimePerHour] = useState("0");
  const [overheadMaterialCostPerHour, setOverheadMaterialCostPerHour] = useState("0");
  const [nextMaintenance, setNextMaintenance] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState("true");

  const isEdit = useMemo(() => Boolean(initialData?.id), [initialData]);

  useEffect(() => {
    if (!open) return;

    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const response = await fetch("/api/manufacturing/groups?includeInactive=true");
        const payload = await response.json();
        if (payload.success) {
          setGroups(
            (payload.data || []).map((group: any) => ({
              id: group.id,
              code: group.code,
              name: group.name,
            }))
          );
        }
      } catch (error) {
        console.error(error);
        toast.error("Failed to load group options");
      } finally {
        setLoadingOptions(false);
      }
    };

    loadOptions();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    setCode(initialData?.code || "");
    setName(initialData?.name || "");
    setBrand(initialData?.brand || "");
    setModel(initialData?.model || "");
    setSerialNumber(initialData?.serialNumber || "");
    setGroupId(initialData?.groupId || "none");
    setStatus(initialData?.status || "IDLE");
    setHealthScore(String(initialData?.healthScore ?? 100));
    setCapacityPerHour(initialData?.capacityPerHour != null ? String(initialData.capacityPerHour) : "");
    setStandardHoursPerDay(String(initialData?.standardHoursPerDay ?? 8));
    setOverheadTimePerHour(String(initialData?.overheadTimePerHour ?? 0));
    setOverheadMaterialCostPerHour(String(initialData?.overheadMaterialCostPerHour ?? 0));
    setNextMaintenance(initialData?.nextMaintenance ? String(initialData.nextMaintenance).slice(0, 10) : "");
    setIsActive(initialData?.isActive === false ? "false" : "true");
    setNotes("");
  }, [open, initialData]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Machine name is required");
      return;
    }

    if (!isEdit && !code.trim()) {
      toast.error("Machine code is required");
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = isEdit ? `/api/manufacturing/machines/${initialData!.id}` : "/api/manufacturing/machines";
      const method = isEdit ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim() || undefined,
          name: name.trim(),
          brand: brand.trim() || undefined,
          model: model.trim() || undefined,
          serialNumber: serialNumber.trim() || undefined,
          groupId: groupId === "none" ? null : groupId,
          status,
          healthScore: Number(healthScore || 100),
          capacityPerHour: capacityPerHour ? Number(capacityPerHour) : null,
          standardHoursPerDay: Number(standardHoursPerDay || 8),
          overheadTimePerHour: Number(overheadTimePerHour || 0),
          overheadMaterialCostPerHour: Number(overheadMaterialCostPerHour || 0),
          nextMaintenance: nextMaintenance || null,
          isActive: isActive === "true",
          notes: notes || undefined,
        }),
      });

      const payload = await response.json();
      if (!payload.success) {
        toast.error(payload.error || "Failed to save machine");
        return;
      }

      toast.success(isEdit ? "Machine updated" : "Machine created");
      onOpenChange(false);
      if (onSaved) await onSaved();
    } catch (error) {
      console.error(error);
      toast.error("Network error while saving machine");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={NB.content}>
        <DialogHeader className={NB.header}>
          <DialogTitle className={NB.title}>
            <Cog className="h-5 w-5" />
            {isEdit ? "Edit Machine" : "Create Machine"}
          </DialogTitle>
          <p className={NB.subtitle}>Data operasional mesin. Detail lanjutan via Document & System.</p>
        </DialogHeader>

        <ScrollArea className={NB.scroll}>
          <div className="p-5 space-y-4">
            {/* Identity */}
            <div className={NB.section}>
              <div className={`${NB.sectionHead} border-l-4 border-l-blue-400 bg-blue-50`}>
                <Cog className="h-4 w-4" />
                <span className={NB.sectionTitle}>Identity</span>
              </div>
              <div className={NB.sectionBody}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={NB.label}>Machine Code {!isEdit && <span className={NB.labelRequired}>*</span>}</label>
                    <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="MC-001" disabled={isEdit} className={NB.inputMono} />
                  </div>
                  <div>
                    <label className={NB.label}>Machine Name <span className={NB.labelRequired}>*</span></label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cutting Machine A" className={NB.input} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={NB.label}>Group</label>
                    <Select value={groupId} onValueChange={setGroupId} disabled={loadingOptions}>
                      <SelectTrigger className={NB.select}>
                        <SelectValue placeholder="Select group" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Group</SelectItem>
                        {groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.code} - {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className={NB.label}>Status</label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger className={NB.select}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IDLE">IDLE</SelectItem>
                        <SelectItem value="RUNNING">RUNNING</SelectItem>
                        <SelectItem value="MAINTENANCE">MAINTENANCE</SelectItem>
                        <SelectItem value="BREAKDOWN">BREAKDOWN</SelectItem>
                        <SelectItem value="OFFLINE">OFFLINE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className={NB.label}>Activation</label>
                    <Select value={isActive} onValueChange={setIsActive}>
                      <SelectTrigger className={NB.select}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Operational */}
            <div className={NB.section}>
              <div className={`${NB.sectionHead} border-l-4 border-l-blue-400 bg-blue-50`}>
                <Activity className="h-4 w-4" />
                <span className={NB.sectionTitle}>Operational</span>
              </div>
              <div className={NB.sectionBody}>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={NB.label}>Capacity / Hour</label>
                    <Input type="number" min={0} value={capacityPerHour} onChange={(e) => setCapacityPerHour(e.target.value)} className={NB.inputMono} />
                  </div>
                  <div>
                    <label className={NB.label}>Std Hours / Day</label>
                    <Input type="number" min={1} value={standardHoursPerDay} onChange={(e) => setStandardHoursPerDay(e.target.value)} className={NB.inputMono} />
                  </div>
                  <div>
                    <label className={NB.label}>Health Score</label>
                    <Input type="number" min={0} max={100} value={healthScore} onChange={(e) => setHealthScore(e.target.value)} className={NB.inputMono} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={NB.label}>Next Maintenance</label>
                    <Input type="date" value={nextMaintenance} onChange={(e) => setNextMaintenance(e.target.value)} className={NB.input} />
                  </div>
                  <div>
                    <label className={NB.label}>Quick Note</label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={NB.textarea + " min-h-[40px]"} placeholder="Optional note" />
                  </div>
                </div>
              </div>
            </div>

            {/* Advanced */}
            <div className={NB.section}>
              <details>
                <summary className={`${NB.sectionHead} border-l-4 border-l-zinc-300 cursor-pointer`}>
                  <Settings2 className="h-4 w-4" />
                  <span className={NB.sectionTitle}>Advanced (Document & System)</span>
                </summary>
                <div className={NB.sectionBody}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className={NB.label}>Brand</label>
                      <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Juki" className={NB.input} />
                    </div>
                    <div>
                      <label className={NB.label}>Model</label>
                      <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="DDL-8700" className={NB.input} />
                    </div>
                    <div>
                      <label className={NB.label}>Serial Number</label>
                      <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="SN-12345" className={NB.inputMono} />
                    </div>
                    <div>
                      <label className={NB.label}>OH Time / Hour</label>
                      <Input type="number" min={0} step="0.01" value={overheadTimePerHour} onChange={(e) => setOverheadTimePerHour(e.target.value)} className={NB.inputMono} />
                    </div>
                    <div className="md:col-span-2">
                      <label className={NB.label}>OH Material Cost / Hour</label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={overheadMaterialCostPerHour}
                        onChange={(e) => setOverheadMaterialCostPerHour(e.target.value)}
                        className={NB.inputMono}
                      />
                    </div>
                  </div>
                </div>
              </details>
            </div>

            {/* Footer */}
            <div className={NB.footer}>
              <Button variant="outline" className={NB.cancelBtn} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button className={NB.submitBtn} disabled={submitting} onClick={handleSubmit}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : isEdit ? "Save Changes" : "Create Machine"}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

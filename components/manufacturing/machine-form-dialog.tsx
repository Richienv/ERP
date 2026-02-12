"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-black/15 bg-zinc-50/50 p-4 space-y-3">
      <div>
        <h4 className="text-sm font-black uppercase tracking-wide">{title}</h4>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </div>
      {children}
    </section>
  );
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
      <DialogContent className="max-w-3xl p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        <DialogHeader className="px-6 py-5 border-b bg-white">
          <DialogTitle className="text-3xl font-black uppercase tracking-tight">{isEdit ? "Edit Machine" : "Create Machine"}</DialogTitle>
          <DialogDescription className="text-sm">
            Form create fokus ke data operasional. Konfigurasi detail lanjutan dipusatkan di menu Document & System.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-4">
          <Section title="Identity">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Machine Code</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="MC-001" disabled={isEdit} />
              </div>
              <div className="space-y-1.5">
                <Label>Machine Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cutting Machine A" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Group</Label>
                <Select value={groupId} onValueChange={setGroupId} disabled={loadingOptions}>
                  <SelectTrigger>
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
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
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
              <div className="space-y-1.5">
                <Label>Activation</Label>
                <Select value={isActive} onValueChange={setIsActive}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Section>

          <Section title="Operational">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Capacity / Hour</Label>
                <Input type="number" min={0} value={capacityPerHour} onChange={(e) => setCapacityPerHour(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Std Hours / Day</Label>
                <Input type="number" min={1} value={standardHoursPerDay} onChange={(e) => setStandardHoursPerDay(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Health Score</Label>
                <Input type="number" min={0} max={100} value={healthScore} onChange={(e) => setHealthScore(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Next Maintenance</Label>
                <Input type="date" value={nextMaintenance} onChange={(e) => setNextMaintenance(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Quick Note</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[42px]" placeholder="Optional note" />
              </div>
            </div>
          </Section>

          <details className="rounded-xl border border-dashed border-black/20 p-4 bg-white">
            <summary className="cursor-pointer text-sm font-bold uppercase tracking-wide">Advanced (Document & System)</summary>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <div className="space-y-1.5">
                <Label>Brand</Label>
                <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Juki" />
              </div>
              <div className="space-y-1.5">
                <Label>Model</Label>
                <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="DDL-8700" />
              </div>
              <div className="space-y-1.5">
                <Label>Serial Number</Label>
                <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="SN-12345" />
              </div>
              <div className="space-y-1.5">
                <Label>OH Time / Hour</Label>
                <Input type="number" min={0} step="0.01" value={overheadTimePerHour} onChange={(e) => setOverheadTimePerHour(e.target.value)} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>OH Material Cost / Hour</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={overheadMaterialCostPerHour}
                  onChange={(e) => setOverheadMaterialCostPerHour(e.target.value)}
                />
              </div>
            </div>
          </details>
        </div>

        <div className="px-6 py-4 border-t bg-zinc-50 flex gap-2">
          <Button variant="outline" className="flex-1 border-black" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1 bg-black text-white hover:bg-zinc-800" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Saving..." : isEdit ? "Save Changes" : "Create Machine"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

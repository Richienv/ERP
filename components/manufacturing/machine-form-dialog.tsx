"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { Cog, Activity, Settings2 } from "lucide-react";
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
  const queryClient = useQueryClient();
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
      queryClient.invalidateQueries({ queryKey: queryKeys.machines.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.mfgDashboard.all });
      if (onSaved) await onSaved();
    } catch (error) {
      console.error(error);
      toast.error("Network error while saving machine");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <NBDialog open={open} onOpenChange={onOpenChange}>
      <NBDialogHeader
        icon={Cog}
        title={isEdit ? "Edit Machine" : "Create Machine"}
        subtitle="Data operasional mesin. Detail lanjutan via Document & System."
      />

      <NBDialogBody>
        {/* Identity */}
        <NBSection icon={Cog} title="Identity">
          <div className="grid grid-cols-2 gap-3">
            <NBInput
              label="Machine Code"
              required={!isEdit}
              value={code}
              onChange={setCode}
              placeholder="MC-001"
              disabled={isEdit}
            />
            <NBInput
              label="Machine Name"
              required
              value={name}
              onChange={setName}
              placeholder="Cutting Machine A"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <NBSelect
              label="Group"
              value={groupId}
              onValueChange={setGroupId}
              placeholder="Select group"
              disabled={loadingOptions}
            >
              <SelectItem value="none">No Group</SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.code} - {group.name}
                </SelectItem>
              ))}
            </NBSelect>
            <NBSelect
              label="Status"
              value={status}
              onValueChange={setStatus}
              options={[
                { value: "IDLE", label: "IDLE" },
                { value: "RUNNING", label: "RUNNING" },
                { value: "MAINTENANCE", label: "MAINTENANCE" },
                { value: "BREAKDOWN", label: "BREAKDOWN" },
                { value: "OFFLINE", label: "OFFLINE" },
              ]}
            />
            <NBSelect
              label="Activation"
              value={isActive}
              onValueChange={setIsActive}
              options={[
                { value: "true", label: "Active" },
                { value: "false", label: "Inactive" },
              ]}
            />
          </div>
        </NBSection>

        {/* Operational */}
        <NBSection icon={Activity} title="Operational">
          <div className="grid grid-cols-3 gap-3">
            <NBInput
              label="Capacity / Hour"
              type="number"
              value={capacityPerHour}
              onChange={setCapacityPerHour}
            />
            <NBInput
              label="Std Hours / Day"
              type="number"
              value={standardHoursPerDay}
              onChange={setStandardHoursPerDay}
            />
            <NBInput
              label="Health Score"
              type="number"
              value={healthScore}
              onChange={setHealthScore}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NBInput
              label="Next Maintenance"
              type="date"
              value={nextMaintenance}
              onChange={setNextMaintenance}
            />
            <NBTextarea
              label="Quick Note"
              value={notes}
              onChange={setNotes}
              placeholder="Optional note"
              rows={2}
            />
          </div>
        </NBSection>

        {/* Advanced */}
        <NBSection icon={Settings2} title="Advanced (Document & System)" optional>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <NBInput label="Brand" value={brand} onChange={setBrand} placeholder="Juki" />
            <NBInput label="Model" value={model} onChange={setModel} placeholder="DDL-8700" />
            <NBInput label="Serial Number" value={serialNumber} onChange={setSerialNumber} placeholder="SN-12345" />
            <NBInput label="OH Time / Hour" type="number" value={overheadTimePerHour} onChange={setOverheadTimePerHour} />
            <NBInput
              label="OH Material Cost / Hour"
              type="number"
              value={overheadMaterialCostPerHour}
              onChange={setOverheadMaterialCostPerHour}
              className="md:col-span-2"
            />
          </div>
        </NBSection>
      </NBDialogBody>

      <NBDialogFooter
        onCancel={() => onOpenChange(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={isEdit ? "Save Changes" : "Create Machine"}
      />
    </NBDialog>
  );
}

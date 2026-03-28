"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { Cog } from "lucide-react";
import {
  NBDialog,
  NBDialogHeader,
  NBDialogBody,
  NBDialogFooter,
  NBSection,
  NBSelect,
} from "@/components/ui/nb-dialog";

interface MachineOption {
  id: string;
  code: string;
  name: string;
  status: string;
  groupId?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  onAssigned?: () => Promise<void> | void;
}

export function AssignMachineGroupDialog({ open, onOpenChange, groupId, groupName, onAssigned }: Props) {
  const queryClient = useQueryClient();
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [machineId, setMachineId] = useState("");

  const availableMachines = useMemo(() => machines.filter((m) => !m.groupId || m.groupId === groupId), [machines, groupId]);

  useEffect(() => {
    if (!open) return;

    const loadMachines = async () => {
      setLoadingOptions(true);
      try {
        const response = await fetch("/api/manufacturing/machines");
        const payload = await response.json();
        if (payload.success) {
          setMachines(
            (payload.data || []).map((machine: any) => ({
              id: machine.id,
              code: machine.code,
              name: machine.name,
              status: machine.status,
              groupId: machine.groupId || null,
            }))
          );
        }
      } catch (error) {
        console.error(error);
        toast.error("Failed to load machine options");
      } finally {
        setLoadingOptions(false);
      }
    };

    setMachineId("");
    loadMachines();
  }, [open]);

  const handleAssign = async () => {
    if (!machineId) {
      toast.error("Select a machine first");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/manufacturing/machines/${machineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      });
      const payload = await response.json();

      if (!payload.success) {
        toast.error(payload.error || "Failed to assign machine");
        return;
      }

      toast.success("Machine assigned to group");
      queryClient.invalidateQueries({ queryKey: queryKeys.machines.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.mfgGroups.all });
      onOpenChange(false);
      if (onAssigned) await onAssigned();
    } catch (error) {
      console.error(error);
      toast.error("Network error while assigning machine");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <NBDialog open={open} onOpenChange={onOpenChange} size="narrow">
      <NBDialogHeader
        icon={Cog}
        title="Assign Machine"
        subtitle={`Link machine to ${groupName}`}
      />

      <NBDialogBody>
        <NBSection icon={Cog} title="Pilih Mesin">
          <NBSelect
            label="Machine"
            required
            value={machineId}
            onValueChange={setMachineId}
            placeholder="Select machine"
            disabled={loadingOptions}
          >
            {availableMachines.map((machine) => (
              <SelectItem key={machine.id} value={machine.id}>
                {machine.code} - {machine.name} ({machine.status})
              </SelectItem>
            ))}
          </NBSelect>
          <p className="text-[9px] text-zinc-400 font-bold">Only unassigned or same-group machines shown</p>
        </NBSection>
      </NBDialogBody>

      <NBDialogFooter
        onCancel={() => onOpenChange(false)}
        onSubmit={handleAssign}
        submitting={submitting}
        submitLabel="Assign"
      />
    </NBDialog>
  );
}

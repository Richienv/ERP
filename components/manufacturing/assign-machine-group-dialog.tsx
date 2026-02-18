"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Cog } from "lucide-react";
import { NB } from "@/lib/dialog-styles";

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={NB.contentNarrow}>
        <DialogHeader className={NB.header}>
          <DialogTitle className={NB.title}>
            <Cog className="h-5 w-5" /> Assign Machine
          </DialogTitle>
          <p className={NB.subtitle}>Link machine to {groupName}</p>
        </DialogHeader>

        <div className="p-5 space-y-4">
          <div className={NB.section}>
            <div className={`${NB.sectionHead} border-l-4 border-l-blue-400 bg-blue-50`}>
              <span className={NB.sectionTitle}>Pilih Mesin</span>
            </div>
            <div className={NB.sectionBody}>
              <div>
                <label className={NB.label}>Machine <span className={NB.labelRequired}>*</span></label>
                <Select value={machineId} onValueChange={setMachineId} disabled={loadingOptions}>
                  <SelectTrigger className={NB.select}>
                    <SelectValue placeholder="Select machine" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMachines.map((machine) => (
                      <SelectItem key={machine.id} value={machine.id}>
                        {machine.code} - {machine.name} ({machine.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[9px] text-zinc-400 font-bold mt-1">Only unassigned or same-group machines shown</p>
              </div>
            </div>
          </div>

          <div className={NB.footer}>
            <Button variant="outline" className={NB.cancelBtn} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className={NB.submitBtn} disabled={submitting} onClick={handleAssign}>
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Assigning...</> : "Assign"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

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
      <DialogContent className="max-w-xl p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        <DialogHeader className="px-6 py-5 border-b bg-white">
          <DialogTitle className="text-3xl font-black uppercase tracking-tight">Assign Machine</DialogTitle>
          <DialogDescription className="text-sm">
            Link machine to <span className="font-semibold text-black">{groupName}</span>. Only unassigned or same-group machines are listed.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          <div className="rounded-xl border border-black/15 bg-zinc-50/50 p-4 space-y-1.5">
            <Label>Machine</Label>
            <Select value={machineId} onValueChange={setMachineId} disabled={loadingOptions}>
              <SelectTrigger>
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
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-zinc-50 flex gap-2">
          <Button variant="outline" className="flex-1 border-black" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1 bg-black text-white hover:bg-zinc-800" disabled={submitting} onClick={handleAssign}>
            {submitting ? "Assigning..." : "Assign"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

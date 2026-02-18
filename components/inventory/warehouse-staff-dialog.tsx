"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, UserCog, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { assignWarehouseManager, getWarehouseStaffing } from "@/app/actions/inventory";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { NB } from "@/lib/dialog-styles";

type StaffingPayload = Awaited<ReturnType<typeof getWarehouseStaffing>>;

interface WarehouseStaffDialogProps {
  warehouseId: string;
  warehouseName: string;
  triggerMode: "staff" | "manager";
}

export function WarehouseStaffDialog({ warehouseId, warehouseName, triggerMode }: WarehouseStaffDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<StaffingPayload | null>(null);
  const [selectedManager, setSelectedManager] = useState("");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const canManageManager = useMemo(
    () => ["ROLE_CEO", "ROLE_DIRECTOR", "ROLE_ADMIN"].includes(user?.role || ""),
    [user?.role]
  );

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    (async () => {
      const payload = await getWarehouseStaffing(warehouseId);
      if (!active) return;
      setData(payload);
      setSelectedManager(payload.currentManager?.id || "");
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [open, warehouseId]);

  const handleAssign = async () => {
    if (!selectedManager) {
      toast.error("Pilih manager terlebih dahulu");
      return;
    }

    setSubmitting(true);
    try {
      const res = await assignWarehouseManager(warehouseId, selectedManager);
      if (!res.success) {
        toast.error(("error" in res && res.error) || "Gagal assign manager");
        return;
      }
      toast.success("Manager gudang berhasil diperbarui");
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerMode === "staff" ? (
          <button type="button" className="w-full text-center">
            <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Active Staff</p>
            <p className="text-2xl font-black">{data?.activeStaff?.length ?? "View"}</p>
          </button>
        ) : (
          <Button variant="outline" size="icon" className="h-9 w-9 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-[1px] hover:translate-x-[1px] bg-white rounded-none">
            <UserCog className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className={NB.contentWide}>
        <DialogHeader className={NB.header}>
          <DialogTitle className={NB.title}>
            <Users className="h-5 w-5" /> Active Staff — {warehouseName}
          </DialogTitle>
          <p className={NB.subtitle}>
            Lihat staf aktif gudang dan {canManageManager ? "assign/replace" : "review"} manager.
          </p>
        </DialogHeader>

        <ScrollArea className={NB.scroll}>
          <div className="p-5 space-y-4">
            {loading ? (
              <div className="py-10 text-center text-zinc-400 font-bold text-xs uppercase">Loading staffing data...</div>
            ) : (
              <>
                {/* Current Manager */}
                <div className={NB.section}>
                  <div className={`${NB.sectionHead} border-l-4 border-l-emerald-400 bg-emerald-50`}>
                    <UserCog className="h-4 w-4" />
                    <span className={NB.sectionTitle}>Current Manager</span>
                  </div>
                  <div className={NB.sectionBody}>
                    <div>
                      <p className="font-black text-base">{data?.currentManager?.name || "Unassigned"}</p>
                      {data?.currentManager?.position && (
                        <p className="text-xs text-zinc-500 font-bold">{data.currentManager.position}</p>
                      )}
                    </div>

                    {canManageManager && (
                      <div className="pt-3 border-t-2 border-dashed border-zinc-200">
                        <label className={NB.label}>Assign / Replace Manager</label>
                        <div className="flex flex-col md:flex-row gap-2">
                          <Select value={selectedManager} onValueChange={setSelectedManager}>
                            <SelectTrigger className={NB.select + " md:flex-1"}>
                              <SelectValue placeholder="Select manager candidate" />
                            </SelectTrigger>
                            <SelectContent>
                              {(data?.managerCandidates || []).map((emp) => (
                                <SelectItem key={emp.id} value={emp.id}>
                                  {emp.name} - {emp.position}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button className={NB.submitBtn} onClick={handleAssign} disabled={submitting || !selectedManager}>
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Save Manager
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Staff List */}
                <div className={NB.section}>
                  <div className={`${NB.sectionHead} border-l-4 border-l-emerald-400 bg-emerald-50`}>
                    <Users className="h-4 w-4" />
                    <span className={NB.sectionTitle}>Active Staff ({data?.activeStaff?.length || 0})</span>
                  </div>
                  {(data?.activeStaff || []).length === 0 ? (
                    <div className="p-4 text-sm text-zinc-400 font-bold">No active staff data.</div>
                  ) : (
                    <div className="divide-y-2 divide-black max-h-80 overflow-auto">
                      {(data?.activeStaff || []).map((emp) => (
                        <div key={emp.id} className="px-4 py-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-sm">{emp.name}</p>
                            <p className="text-xs text-zinc-500">
                              {emp.position} - {emp.department}
                            </p>
                          </div>
                          <span className="text-[10px] font-black uppercase border-2 border-black px-2 py-0.5">
                            {emp.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

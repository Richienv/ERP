"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, UserCog, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NBDialog,
  NBDialogHeader,
  NBDialogBody,
  NBSection,
  NBSelect,
} from "@/components/ui/nb-dialog";
import { assignWarehouseManager, getWarehouseStaffing } from "@/app/actions/inventory";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

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
      try {
        const payload = await getWarehouseStaffing(warehouseId);
        if (!active) return;
        setData(payload);
        setSelectedManager(payload.currentManager?.id || "");
        setLoading(false);
      } catch {
        setLoading(false);
        toast.error("Gagal memuat data staff");
      }
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
    } catch (err: any) {
      toast.error(err.message || "Gagal menugaskan manager");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {triggerMode === "staff" ? (
        <button type="button" className="w-full text-center" onClick={() => setOpen(true)}>
          <p className="text-xs font-bold text-muted-foreground mb-1">Active Staff</p>
          <p className="text-2xl font-semibold">{data?.activeStaff?.length ?? "View"}</p>
        </button>
      ) : (
        <Button
          variant="outline"
          size="icon"
          onClick={() => setOpen(true)}
          className="h-9 w-9 border border-border shadow-sm hover:shadow-none bg-white rounded-md"
        >
          <UserCog className="h-4 w-4" />
        </Button>
      )}

      <NBDialog open={open} onOpenChange={setOpen} size="wide">
        <NBDialogHeader
          icon={Users}
          title={`Active Staff — ${warehouseName}`}
          subtitle={`Lihat staf aktif gudang dan ${canManageManager ? "assign/replace" : "review"} manager.`}
        />

        <NBDialogBody>
          {loading ? (
            <div className="py-10 text-center text-zinc-400 font-bold text-xs ">Loading staffing data...</div>
          ) : (
            <>
              {/* Current Manager */}
              <NBSection icon={UserCog} title="Current Manager">
                <div>
                  <p className="font-semibold text-base">{data?.currentManager?.name || "Unassigned"}</p>
                  {data?.currentManager?.position && (
                    <p className="text-xs text-zinc-500 font-bold">{data.currentManager.position}</p>
                  )}
                </div>

                {canManageManager && (
                  <div className="pt-3 border-t border-dashed border-zinc-200">
                    <NBSelect
                      label="Assign / Replace Manager"
                      value={selectedManager}
                      onValueChange={setSelectedManager}
                      placeholder="Select manager candidate"
                      options={(data?.managerCandidates || []).map((emp) => ({
                        value: emp.id,
                        label: `${emp.name} - ${emp.position}`,
                      }))}
                    />
                    <Button
                      className="bg-slate-900 text-white border border-border hover:bg-zinc-800 font-semibold text-xs px-5 h-8 rounded-md mt-2"
                      onClick={handleAssign}
                      disabled={submitting || !selectedManager}
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Save Manager
                    </Button>
                  </div>
                )}
              </NBSection>

              {/* Staff List */}
              <NBSection icon={Users} title={`Active Staff (${data?.activeStaff?.length || 0})`}>
                {(data?.activeStaff || []).length === 0 ? (
                  <div className="text-sm text-zinc-400 font-bold">No active staff data.</div>
                ) : (
                  <div className="divide-y divide-zinc-200 max-h-80 overflow-auto -mx-3 -mb-3">
                    {(data?.activeStaff || []).map((emp) => (
                      <div key={emp.id} className="px-3 py-2.5 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-sm">{emp.name}</p>
                          <p className="text-xs text-zinc-500">
                            {emp.position} - {emp.department}
                          </p>
                        </div>
                        <span className="text-xs font-semibold border border-border px-2 py-0.5">
                          {emp.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </NBSection>
            </>
          )}
        </NBDialogBody>
      </NBDialog>
    </>
  );
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Users, UserCog, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { assignWarehouseManager, getWarehouseStaffing } from "@/app/actions/inventory"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"

type StaffingPayload = Awaited<ReturnType<typeof getWarehouseStaffing>>

interface WarehouseStaffDialogProps {
  warehouseId: string
  warehouseName: string
  triggerMode: "staff" | "manager"
}

export function WarehouseStaffDialog({ warehouseId, warehouseName, triggerMode }: WarehouseStaffDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [data, setData] = useState<StaffingPayload | null>(null)
  const [selectedManager, setSelectedManager] = useState("")
  const { user } = useAuth()
  const router = useRouter()

  const canManageManager = useMemo(
    () => ["ROLE_CEO", "ROLE_DIRECTOR", "ROLE_ADMIN"].includes(user?.role || ""),
    [user?.role]
  )

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    ;(async () => {
      const payload = await getWarehouseStaffing(warehouseId)
      if (!active) return
      setData(payload)
      setSelectedManager(payload.currentManager?.id || "")
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [open, warehouseId])

  const handleAssign = async () => {
    if (!selectedManager) {
      toast.error("Pilih manager terlebih dahulu")
      return
    }

    setSubmitting(true)
    try {
      const res = await assignWarehouseManager(warehouseId, selectedManager)
      if (!res.success) {
        toast.error(("error" in res && res.error) || "Gagal assign manager")
        return
      }
      toast.success("Manager gudang berhasil diperbarui")
      router.refresh()
      setOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerMode === "staff" ? (
          <button type="button" className="w-full text-center">
            <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Active Staff</p>
            <p className="text-2xl font-black">{data?.activeStaff?.length ?? "View"}</p>
          </button>
        ) : (
          <Button variant="outline" size="icon" className="h-9 w-9 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-[1px] hover:translate-x-[1px] bg-white">
            <UserCog className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Active Staff - {warehouseName}
          </DialogTitle>
          <DialogDescription>
            Lihat staf aktif gudang dan {canManageManager ? "assign/replace" : "review"} manager gudang.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center text-muted-foreground font-medium">Loading staffing data...</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border p-3 bg-zinc-50">
              <p className="text-xs uppercase font-bold text-zinc-500 mb-1">Current Manager</p>
              <p className="font-bold">{data?.currentManager?.name || "Unassigned"}</p>
              {data?.currentManager?.position && <p className="text-xs text-zinc-500">{data.currentManager.position}</p>}
            </div>

            {canManageManager && (
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase font-bold text-zinc-500 mb-2">Assign / Replace Manager</p>
                <div className="flex flex-col md:flex-row gap-2">
                  <Select value={selectedManager} onValueChange={setSelectedManager}>
                    <SelectTrigger className="md:flex-1">
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
                  <Button onClick={handleAssign} disabled={submitting || !selectedManager}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save Manager
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-lg border overflow-hidden">
              <div className="bg-zinc-100 px-3 py-2 text-xs font-bold uppercase">Active Staff ({data?.activeStaff?.length || 0})</div>
              <div className="max-h-80 overflow-auto divide-y">
                {(data?.activeStaff || []).length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No active staff data.</p>
                ) : (
                  (data?.activeStaff || []).map((emp) => (
                    <div key={emp.id} className="px-3 py-2 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{emp.name}</p>
                        <p className="text-xs text-zinc-500">{emp.position} - {emp.department}</p>
                      </div>
                      <Badge variant="outline">{emp.status}</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

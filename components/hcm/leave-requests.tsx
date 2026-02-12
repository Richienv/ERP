"use client"

import { useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Check, X } from "lucide-react"
import { toast } from "sonner"
import { approveLeaveRequest, rejectLeaveRequest } from "@/app/actions/hcm"

interface LeaveRequestItem {
    id: string
    employeeName: string
    type: string
    days: number
    startDate: string
    endDate: string
}

interface LeaveRequestWidgetProps {
    requests?: LeaveRequestItem[]
    pendingCount?: number
    onChanged?: () => void
}

export function LeaveRequestWidget({ requests = [], pendingCount = 0, onChanged }: LeaveRequestWidgetProps) {
    const [isPending, startTransition] = useTransition()

    const runAction = (requestId: string, mode: "APPROVE" | "REJECT") => {
        startTransition(async () => {
            try {
                const result =
                    mode === "APPROVE"
                        ? await approveLeaveRequest(requestId)
                        : await rejectLeaveRequest(requestId, "Ditolak dari dashboard SDM")

                if (!result.success) {
                    toast.error("error" in result ? String(result.error) : "Gagal memproses cuti")
                    return
                }

                toast.success("message" in result ? result.message : "Pengajuan cuti berhasil diproses")
                onChanged?.()
            } catch {
                toast.error("Terjadi kesalahan saat memproses cuti")
            }
        })
    }

    return (
        <Card className="col-span-1 md:col-span-2">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">Permintaan Cuti & Izin</CardTitle>
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                        {pendingCount} Pending
                    </span>
                </div>
            </CardHeader>
            <CardContent>
                {requests.length === 0 ? (
                    <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                        Tidak ada permintaan cuti pending.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {requests.map((request) => (
                            <div key={request.id} className="group flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9 border">
                                        <AvatarFallback>
                                            {request.employeeName
                                                .split(" ")
                                                .map((word) => word[0])
                                                .join("")
                                                .slice(0, 2)
                                                .toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm font-medium leading-none">{request.employeeName}</p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {request.type} • {new Date(request.startDate).toLocaleDateString("id-ID")} -{" "}
                                            {new Date(request.endDate).toLocaleDateString("id-ID")} ({request.days} hari)
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-green-600 hover:bg-green-50 hover:text-green-700"
                                        disabled={isPending}
                                        onClick={() => runAction(request.id, "APPROVE")}
                                    >
                                        <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                                        disabled={isPending}
                                        onClick={() => runAction(request.id, "REJECT")}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

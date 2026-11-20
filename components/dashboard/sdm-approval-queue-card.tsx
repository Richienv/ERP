"use client"

import Link from "next/link"
import { ClipboardCheck, ArrowRight, Clock3 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface SDMApprovalQueueCardProps {
    data?: {
        pendingLeaves?: number
        pendingStockOpname?: number
        pendingPayroll?: number
        totalPending?: number
    } | null
}

export function SDMApprovalQueueCard({ data }: SDMApprovalQueueCardProps) {
    const pendingLeaves = Number(data?.pendingLeaves || 0)
    const pendingStockOpname = Number(data?.pendingStockOpname || 0)
    const pendingPayroll = Number(data?.pendingPayroll || 0)
    const totalPending = Number(data?.totalPending || pendingLeaves + pendingStockOpname + pendingPayroll)

    return (
        <div className="h-full group/queue">
            <Card className="h-full flex flex-col border border-border shadow-sm rounded-xl overflow-hidden bg-white hover:shadow-sm transition-all duration-200">
                <CardHeader className="pb-3 border-b border-border bg-zinc-50 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <ClipboardCheck className="h-5 w-5 text-amber-600" />
                        SDM Approval Queue
                    </CardTitle>
                    <Badge variant="outline" className="bg-white text-black border-border shadow-sm">
                        <Clock3 className="h-3 w-3 mr-1" />
                        {totalPending} Pending
                    </Badge>
                </CardHeader>

                <CardContent className="p-4 flex-1 flex flex-col justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between rounded-md border border-zinc-200 p-2">
                            <span className="text-xs font-bold text-zinc-600">Cuti</span>
                            <span className="text-sm font-semibold">{pendingLeaves}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-md border border-zinc-200 p-2">
                            <span className="text-xs font-bold text-zinc-600">Stock Opname</span>
                            <span className="text-sm font-semibold">{pendingStockOpname}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-md border border-zinc-200 p-2">
                            <span className="text-xs font-bold text-zinc-600">Payroll</span>
                            <span className="text-sm font-semibold">{pendingPayroll}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                        <Link href="/hcm/attendance">
                            <Button variant="outline" className="w-full justify-between border-border text-xs font-bold ">
                                Review Cuti
                                <ArrowRight className="h-3 w-3" />
                            </Button>
                        </Link>
                        <Link href="/inventory/audit">
                            <Button variant="outline" className="w-full justify-between border-border text-xs font-bold ">
                                Review Stock Opname
                                <ArrowRight className="h-3 w-3" />
                            </Button>
                        </Link>
                        <Link href="/hcm/payroll">
                            <Button variant="outline" className="w-full justify-between border-border text-xs font-bold ">
                                Review Payroll
                                <ArrowRight className="h-3 w-3" />
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}


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
            <Card className="h-full flex flex-col border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-200">
                <CardHeader className="pb-3 border-b border-black bg-zinc-50 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
                        <ClipboardCheck className="h-5 w-5 text-amber-600" />
                        SDM Approval Queue
                    </CardTitle>
                    <Badge variant="outline" className="bg-white text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <Clock3 className="h-3 w-3 mr-1" />
                        {totalPending} Pending
                    </Badge>
                </CardHeader>

                <CardContent className="p-4 flex-1 flex flex-col justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between rounded-md border border-zinc-200 p-2">
                            <span className="text-xs font-bold uppercase text-zinc-600">Cuti</span>
                            <span className="text-sm font-black">{pendingLeaves}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-md border border-zinc-200 p-2">
                            <span className="text-xs font-bold uppercase text-zinc-600">Stock Opname</span>
                            <span className="text-sm font-black">{pendingStockOpname}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-md border border-zinc-200 p-2">
                            <span className="text-xs font-bold uppercase text-zinc-600">Payroll</span>
                            <span className="text-sm font-black">{pendingPayroll}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                        <Link href="/hcm/attendance">
                            <Button variant="outline" className="w-full justify-between border-black text-xs font-bold uppercase">
                                Review Cuti
                                <ArrowRight className="h-3 w-3" />
                            </Button>
                        </Link>
                        <Link href="/inventory/audit">
                            <Button variant="outline" className="w-full justify-between border-black text-xs font-bold uppercase">
                                Review Stock Opname
                                <ArrowRight className="h-3 w-3" />
                            </Button>
                        </Link>
                        <Link href="/hcm/payroll">
                            <Button variant="outline" className="w-full justify-between border-black text-xs font-bold uppercase">
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


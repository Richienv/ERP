"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
    MoreHorizontal,
    Calendar,
    Clock,
    ArrowRight,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    FileText
} from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"

interface Quotation {
    id: string
    number: string
    customerName: string
    total: number
    status: string
    quotationDate: string
    validUntil: string
    salesPerson: string
    notes: string
}

interface QuotationKanbanProps {
    quotations: Quotation[]
}

export function QuotationKanban({ quotations }: QuotationKanbanProps) {

    // Calculate Win Probability based on status and age (Mock)
    const getWinProbability = (qt: Quotation) => {
        if (qt.status === 'ACCEPTED' || qt.status === 'CONVERTED') return 100
        if (qt.status === 'REJECTED' || qt.status === 'EXPIRED') return 0
        if (qt.status === 'SENT') {
            // Mock: If sent within 3 days, high. Else medium.
            const daysOld = Math.floor((new Date().getTime() - new Date(qt.quotationDate).getTime()) / (1000 * 3600 * 24))
            if (daysOld < 3) return 75
            if (daysOld < 7) return 50
            return 25
        }
        return 10 // Draft
    }

    // Group by Status
    const columns = {
        DRAFT: { label: "DRAFT", color: "border-t-4 border-t-zinc-400" },
        SENT: { label: "SENT TO CLIENT", color: "border-t-4 border-t-blue-500" },
        ACCEPTED: { label: "ACCEPTED", color: "border-t-4 border-t-emerald-500" },
        EXPIRED: { label: "LOST / EXPIRED", color: "border-t-4 border-t-red-500" }
    }

    const getStatusColumn = (status: string) => {
        if (['REJECTED', 'EXPIRED'].includes(status)) return 'EXPIRED'
        if (status === 'CONVERTED') return 'ACCEPTED'
        return status
    }

    // Render Card
    const KanbanCard = ({ qt }: { qt: Quotation }) => {
        const probability = getWinProbability(qt)
        const isStalled = qt.status === 'SENT' && probability < 30

        return (
            <div className="bg-white border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-lg p-3 mb-3 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer relative overflow-hidden group">

                {/* Stall Alert Strip */}
                {isStalled && (
                    <div className="absolute top-0 right-0 p-1 bg-red-100 border-l border-b border-black rounded-bl-lg">
                        <Clock className="h-3 w-3 text-red-600 animate-pulse" />
                    </div>
                )}

                <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-[10px] text-muted-foreground font-bold">{qt.number}</span>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Edit Quote</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-blue-600 font-bold">Follow Up</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <h4 className="font-bold text-sm leading-tight mb-2 line-clamp-2">{qt.customerName}</h4>

                <div className="flex justify-between items-center mt-3 pt-3 border-t border-dashed border-zinc-200">
                    <span className="font-black text-sm">
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: 'compact' }).format(qt.total)}
                    </span>

                    {qt.status !== 'ACCEPTED' && qt.status !== 'CONVERTED' && qt.status !== 'EXPIRED' && qt.status !== 'REJECTED' && (
                        <Badge variant="outline" className={`text-[10px] h-5 px-1 border-0 ${probability > 50 ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'} font-bold`}>
                            {probability}% WIN
                        </Badge>
                    )}
                </div>

                {/* Sales Person Avatar / Initials */}
                <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(qt.quotationDate).toLocaleDateString()}
                    </div>
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">
                        {qt.salesPerson.split(' ').map(n => n[0]).join('')}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex overflow-x-auto pb-4 gap-4 h-[calc(100vh-220px)] min-w-full">
            {Object.entries(columns).map(([key, col]) => (
                <div key={key} className="min-w-[280px] w-[320px] flex flex-col h-full bg-zinc-50 border border-black/10 rounded-xl p-2">

                    {/* Column Header */}
                    <div className={`p-3 mb-2 bg-white border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-lg ${col.color}`}>
                        <div className="flex justify-between items-center">
                            <h3 className="font-black text-xs uppercase tracking-widest">{col.label}</h3>
                            <Badge variant="secondary" className="bg-zinc-100 text-black border border-black/20 text-[10px]">
                                {quotations.filter(q => getStatusColumn(q.status) === key).length}
                            </Badge>
                        </div>
                        <div className="mt-1 text-[10px] font-mono text-muted-foreground flex justify-between">
                            <span>Est. Value:</span>
                            <span className="font-bold text-black">
                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: 'compact' }).format(
                                    quotations.filter(q => getStatusColumn(q.status) === key).reduce((sum, q) => sum + q.total, 0)
                                )}
                            </span>
                        </div>
                    </div>

                    {/* Droppable Area (Visual only for now) */}
                    <div className="flex-1 overflow-y-auto px-1 space-y-1 scrollbar-hide">
                        {quotations
                            .filter(q => getStatusColumn(q.status) === key)
                            .map(qt => (
                                <KanbanCard key={qt.id} qt={qt} />
                            ))}

                        {quotations.filter(q => getStatusColumn(q.status) === key).length === 0 && (
                            <div className="h-24 flex items-center justify-center border-2 border-dashed border-zinc-200 rounded-lg m-1">
                                <span className="text-[10px] text-zinc-400 font-medium uppercase">No Deals</span>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}

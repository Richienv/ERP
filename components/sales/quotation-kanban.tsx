"use client"

import { Button } from "@/components/ui/button"
import {
    MoreHorizontal,
    Calendar,
    Clock,
    ArrowRight,
    Eye,
    Pencil,
    Send,
    CheckCircle2,
    XCircle,
    FileText,
} from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { updateQuotationStatus } from "@/lib/actions/sales"
import { toast } from "sonner"

const formatCompact = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)

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

    const handleStatusChange = async (id: string, newStatus: string) => {
        try {
            const result = await updateQuotationStatus(id, newStatus)
            if (result.success) {
                toast.success(`Status berhasil diubah ke ${newStatus}`)
            } else {
                toast.error("Gagal mengubah status")
            }
        } catch {
            toast.error("Error mengubah status")
        }
    }

    const getWinProbability = (qt: Quotation) => {
        if (qt.status === 'ACCEPTED' || qt.status === 'CONVERTED') return 100
        if (qt.status === 'REJECTED' || qt.status === 'EXPIRED') return 0
        if (qt.status === 'SENT') {
            const daysOld = Math.floor((Date.now() - new Date(qt.quotationDate).getTime()) / (1000 * 3600 * 24))
            if (daysOld < 3) return 75
            if (daysOld < 7) return 50
            return 25
        }
        return 10
    }

    const columns = {
        DRAFT: { label: "Draft", accent: "bg-zinc-400", countBg: "bg-zinc-100 text-zinc-700" },
        SENT: { label: "Terkirim", accent: "bg-blue-500", countBg: "bg-blue-100 text-blue-700" },
        ACCEPTED: { label: "Diterima", accent: "bg-emerald-500", countBg: "bg-emerald-100 text-emerald-700" },
        EXPIRED: { label: "Gagal / Expired", accent: "bg-red-500", countBg: "bg-red-100 text-red-700" },
    }

    const getStatusColumn = (status: string) => {
        if (['REJECTED', 'EXPIRED'].includes(status)) return 'EXPIRED'
        if (status === 'CONVERTED') return 'ACCEPTED'
        return status
    }

    const KanbanCard = ({ qt }: { qt: Quotation }) => {
        const probability = getWinProbability(qt)
        const isStalled = qt.status === 'SENT' && probability < 30

        return (
            <div className="bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] p-3 mb-3 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer relative overflow-hidden group">

                {/* Stall Alert */}
                {isStalled && (
                    <div className="absolute top-0 right-0 px-1.5 py-0.5 bg-red-500 border-l-2 border-b-2 border-black">
                        <Clock className="h-3 w-3 text-white animate-pulse" />
                    </div>
                )}

                {/* Header: Number + Actions */}
                <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-[10px] text-zinc-400 font-black tracking-wider">{qt.number}</span>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-none">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] rounded-none">
                            <DropdownMenuItem className="text-xs font-bold">
                                <Eye className="mr-2 h-3.5 w-3.5" /> Lihat Detail
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-xs font-bold">
                                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit Penawaran
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Ubah Status</DropdownMenuLabel>
                            {qt.status === 'DRAFT' && (
                                <DropdownMenuItem onClick={() => handleStatusChange(qt.id, 'SENT')} className="text-xs font-bold">
                                    <Send className="mr-2 h-3.5 w-3.5" /> Tandai Terkirim
                                </DropdownMenuItem>
                            )}
                            {qt.status === 'SENT' && (
                                <>
                                    <DropdownMenuItem onClick={() => handleStatusChange(qt.id, 'ACCEPTED')} className="text-xs font-bold text-emerald-600">
                                        <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Tandai Diterima
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleStatusChange(qt.id, 'REJECTED')} className="text-xs font-bold text-red-600">
                                        <XCircle className="mr-2 h-3.5 w-3.5" /> Tandai Ditolak
                                    </DropdownMenuItem>
                                </>
                            )}
                            {qt.status === 'ACCEPTED' && (
                                <DropdownMenuItem className="text-xs font-bold text-violet-600">
                                    <ArrowRight className="mr-2 h-3.5 w-3.5" /> Konversi ke PO
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Customer */}
                <h4 className="font-black text-sm leading-tight mb-2 line-clamp-2 text-zinc-900">{qt.customerName}</h4>

                {/* Amount + Win % */}
                <div className="flex justify-between items-center mt-3 pt-2.5 border-t-2 border-dashed border-zinc-200">
                    <span className="font-black text-sm tracking-tight">
                        {formatCompact(qt.total)}
                    </span>

                    {qt.status !== 'ACCEPTED' && qt.status !== 'CONVERTED' && qt.status !== 'EXPIRED' && qt.status !== 'REJECTED' && (
                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 border-2 border-black ${probability > 50 ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                            {probability}% Win
                        </span>
                    )}
                </div>

                {/* Footer: Date + Salesperson */}
                <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-bold">
                        <Calendar className="h-3 w-3" />
                        {new Date(qt.quotationDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                    </div>
                    <div className="bg-zinc-900 text-white text-[9px] font-black px-1.5 py-0.5 tracking-wider uppercase">
                        {qt.salesPerson.split(' ').map(n => n[0]).join('')}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex overflow-x-auto pb-4 gap-4 h-[calc(100vh-340px)] min-w-full">
            {Object.entries(columns).map(([key, col]) => {
                const colItems = quotations.filter(q => getStatusColumn(q.status) === key)
                const colTotal = colItems.reduce((sum, q) => sum + q.total, 0)

                return (
                    <div key={key} className="min-w-[280px] w-[320px] flex flex-col h-full border-2 border-black bg-white dark:bg-zinc-900 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">

                        {/* Column Header */}
                        <div className="border-b-2 border-black">
                            {/* Accent bar */}
                            <div className={`h-1.5 ${col.accent}`} />
                            <div className="px-4 py-3">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-900 dark:text-white">{col.label}</h3>
                                    <span className={`text-[10px] font-black px-2 py-0.5 border-2 border-black ${col.countBg}`}>
                                        {colItems.length}
                                    </span>
                                </div>
                                <div className="mt-1.5 flex items-center justify-between text-[10px]">
                                    <span className="font-bold text-zinc-400 uppercase tracking-wider">Nilai</span>
                                    <span className="font-black text-zinc-900 dark:text-white tracking-tight">
                                        {formatCompact(colTotal)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Cards */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-0 scrollbar-hide bg-zinc-50 dark:bg-zinc-950">
                            {colItems.map(qt => (
                                <KanbanCard key={qt.id} qt={qt} />
                            ))}

                            {colItems.length === 0 && (
                                <div className="h-24 flex flex-col items-center justify-center border-2 border-dashed border-zinc-300 m-1">
                                    <FileText className="h-4 w-4 text-zinc-300 mb-1" />
                                    <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">Kosong</span>
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

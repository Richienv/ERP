"use client"

import { useEffect, useState, useTransition } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getVendorHistory } from "@/app/actions/vendor"
import { Loader2, AlertCircle } from "lucide-react"

interface HistoryItem {
    id: string
    number: string
    date: Date
    status: string
    totalAmount: number
    itemCount: number
}

interface VendorHistoryDialogProps {
    vendorId: string
    vendorName: string
    trigger?: React.ReactNode
}

export function VendorHistoryDialog({ vendorId, vendorName, trigger }: VendorHistoryDialogProps) {
    const [open, setOpen] = useState(false)
    const [history, setHistory] = useState<HistoryItem[]>([])
    const [isPending, startTransition] = useTransition()
    const [hasLoaded, setHasLoaded] = useState(false)

    useEffect(() => {
        if (open && !hasLoaded) {
            startTransition(async () => {
                const data = await getVendorHistory(vendorId)
                setHistory(data)
                setHasLoaded(true)
            })
        }
    }, [open, vendorId, hasLoaded])

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'OPEN': return 'bg-blue-100 text-blue-700 border-blue-200'
            case 'PARTIAL': return 'bg-amber-100 text-amber-700 border-amber-200'
            case 'CLOSED': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
            case 'CANCELLED': return 'bg-rose-100 text-rose-700 border-rose-200'
            default: return 'bg-zinc-100 text-zinc-700 border-zinc-200'
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" className="flex-1 border-black font-bold uppercase text-xs shadow-sm hover:shadow-none bg-white">
                        History
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader className="border-b pb-4 mb-4">
                    <DialogTitle className="flex items-center gap-2">
                        <span className="font-black text-xl uppercase">Riwayat Pesanan</span>
                        <Badge variant="outline" className="text-muted-foreground font-medium">{vendorName}</Badge>
                    </DialogTitle>
                </DialogHeader>

                {isPending ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin mb-2" />
                        <p>Memuat riwayat...</p>
                    </div>
                ) : history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-zinc-50 rounded-lg border border-dashed">
                        <AlertCircle className="h-10 w-10 mb-2 opacity-50" />
                        <p className="font-medium">Belum ada riwayat pesanan</p>
                        <p className="text-sm">Pesanan yang dibuat akan muncul di sini.</p>
                    </div>
                ) : (
                    <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-3">
                            {history.map((po) => (
                                <div key={po.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-zinc-50 transition-colors">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold text-sm bg-zinc-100 px-2 py-0.5 rounded">{po.number}</span>
                                            <Badge variant="outline" className={`text-[10px] font-bold uppercase border ${getStatusColor(po.status)}`}>
                                                {po.status}
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-muted-foreground font-medium">
                                            {new Date(po.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-black text-lg">
                                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(po.totalAmount)}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {po.itemCount} Item
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </DialogContent>
        </Dialog>
    )
}

"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Clock, FileText, AlertCircle, CheckCircle2, UserPlus, ArrowRight } from "lucide-react"
import Link from "next/link"

export function RitchieActivityFeed() {
    const activities = [
        {
            id: 1,
            title: "Pesanan Produksi Baru #PO-8932",
            desc: "Pesanan masuk untuk 500 lusin Kaos Polos.",
            time: "10m ago",
            icon: FileText,
            color: "text-blue-600",
            bg: "bg-blue-50"
        },
        {
            id: 2,
            title: "Stok Benang Polyester Rendah",
            desc: "Stok di Gudang A tersisa < 150 kg.",
            time: "45m ago",
            icon: AlertCircle,
            color: "text-amber-600",
            bg: "bg-amber-50"
        },
        {
            id: 3,
            title: "QC Lolos - Batch #B-992",
            desc: "Hasil pewarnaan batch Cotton Combed 24s OK.",
            time: "2h ago",
            icon: CheckCircle2,
            color: "text-emerald-600",
            bg: "bg-emerald-50"
        },
        {
            id: 4,
            title: "Karyawan Baru Terdaftar",
            desc: "3 operator jahit baru ditambahkan ke HR.",
            time: "5h ago",
            icon: UserPlus,
            color: "text-purple-600",
            bg: "bg-purple-50"
        },
    ]

    return (
        <Link href="/hcm" className="block h-full group hover:no-underline cursor-pointer">
            <Card className="h-full flex flex-col border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white dark:bg-black hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all duration-200">
                <CardHeader className="pb-3 border-b border-black bg-zinc-50 dark:bg-zinc-900 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
                        <Clock className="h-5 w-5 text-blue-600" />
                        Aktivitas Terbaru
                    </CardTitle>
                    <Badge variant="outline" className="bg-white text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        Live
                    </Badge>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                    <ScrollArea className="h-[400px]">
                        <div className="divide-y divide-black/5">
                            {activities.map((item) => (
                                <div key={item.id} className="p-4 flex gap-3 hover:bg-zinc-50 transition-colors">
                                    <div className={`h-8 w-8 rounded border border-black/10 flex items-center justify-center flex-shrink-0 ${item.bg}`}>
                                        <item.icon className={`h-4 w-4 ${item.color}`} />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <p className="font-bold text-sm leading-none">{item.title}</p>
                                            <span className="text-[10px] text-muted-foreground font-mono">{item.time}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-snug">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 bg-zinc-50 border-t border-black/10 flex items-center justify-center text-xs font-bold text-muted-foreground group-hover:text-blue-600 transition-colors">
                            View All Logs <ArrowRight className="ml-1 h-3 w-3" />
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </Link>
    )
}

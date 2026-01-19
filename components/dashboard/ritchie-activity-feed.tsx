"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import {
    Clock, FileText, AlertCircle, CheckCircle2, UserPlus, ArrowRight,
    Calendar, User, Box, MapPin
} from "lucide-react"
import Link from "next/link"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"


interface RitchieActivityFeedProps {
    data: any[]
}

export function RitchieActivityFeed({ data }: RitchieActivityFeedProps) {
    const [selectedItem, setSelectedItem] = useState<any>(null)
    const [isOpen, setIsOpen] = useState(false)

    // Map the incoming data to icons and proper display format if needed, OR assume data is already formatted by server action.
    // The server action returns { id, type, title, desc, date, color, bg }.
    // We need to map 'type' to Icon.

    const getIcon = (type: string) => {
        switch (type) {
            case 'Order': return FileText
            case 'Inventory': return AlertCircle
            case 'Quality': return CheckCircle2
            case 'HR': return UserPlus
            default: return Clock
        }
    }

    const activities = (data || []).map(item => ({
        ...item,
        title: item.title || item.message, // Fallback to message if title missing (server returns message)
        desc: item.desc || (item.user ? `By ${item.user}` : item.type), // Synthesize desc if missing
        icon: getIcon(item.type),
        time: item.time ? new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        details: item.message // reuse message for details
    }))


    const handleItemClick = (item: any) => {
        setSelectedItem(item)
        setIsOpen(true)
    }

    return (
        <div className="h-full group/card">
            <Card className="h-full flex flex-col border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white dark:bg-black hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-200">
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
                                <div
                                    key={item.id}
                                    onClick={() => handleItemClick(item)}
                                    className="p-4 flex gap-3 hover:bg-zinc-50 transition-colors cursor-pointer group/item"
                                >
                                    <div className={`h-8 w-8 rounded border border-black/10 flex items-center justify-center flex-shrink-0 ${item.bg}`}>
                                        <item.icon className={`h-4 w-4 ${item.color}`} />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <p className="font-bold text-sm leading-none group-hover/item:text-blue-600 transition-colors">{item.title}</p>
                                            <span className="text-[10px] text-muted-foreground font-mono">{item.time}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-snug">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                    <div className="p-4 bg-zinc-50 border-t border-black/10 flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground font-medium">Real-time Feed</span>
                        <Link href="/reports">
                            <div className="flex items-center text-xs font-bold text-muted-foreground hover:text-blue-600 transition-colors cursor-pointer">
                                View Activity Log <ArrowRight className="ml-1 h-3 w-3" />
                            </div>
                        </Link>
                    </div>
                </CardContent>
            </Card>

            {/* Detail Dialog */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-xl border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white p-0 overflow-hidden gap-0">
                    <DialogHeader className="p-6 bg-zinc-50 border-b border-black">
                        <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className={`bg-white border-black ${selectedItem?.color}`}>{selectedItem?.type}</Badge>
                            <span className="text-xs font-mono text-muted-foreground">{selectedItem?.time}</span>
                        </div>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tight leading-none">{selectedItem?.title}</DialogTitle>
                    </DialogHeader>

                    <div className="p-6 space-y-8">
                        {/* 1. Context Box */}
                        <div className="bg-white rounded-xl border border-black/10 p-5 shadow-sm space-y-2">
                            <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Strategic Context</h4>
                            <p className="text-base text-foreground leading-relaxed font-medium">
                                {selectedItem?.details}
                            </p>
                        </div>

                        {/* 2. Recommended Next Steps */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground border-b border-black/5 pb-2">Next Immediate Actions</h4>
                            <div className="bg-zinc-50 rounded-lg p-3 border border-black/5 flex gap-3 items-center">
                                <div className="h-6 w-6 rounded-full bg-black text-white flex items-center justify-center font-bold text-xs">1</div>
                                <span className="text-sm font-bold">Review full report details</span>
                            </div>
                            <div className="bg-zinc-50 rounded-lg p-3 border border-black/5 flex gap-3 items-center">
                                <div className="h-6 w-6 rounded-full bg-white border border-black text-black flex items-center justify-center font-bold text-xs">2</div>
                                <span className="text-sm font-medium">Assignable to: {selectedItem?.user}</span>
                            </div>
                        </div>

                        {/* 3. Metadata Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1 p-3 bg-zinc-50 rounded-lg border border-black/5">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                    <User className="h-3 w-3" /> Initiated By
                                </span>
                                <p className="text-sm font-bold">{selectedItem?.user}</p>
                            </div>
                            <div className="space-y-1 p-3 bg-zinc-50 rounded-lg border border-black/5">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" /> Date Logged
                                </span>
                                <p className="text-sm font-bold">{new Date().toLocaleDateString()}</p>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-zinc-50 border-t border-black gap-3">
                        <Button variant="outline" onClick={() => setIsOpen(false)} className="flex-1 border-black font-bold h-12 uppercase tracking-wide">Close</Button>
                        <Button className="flex-1 bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none font-black h-12 uppercase tracking-wide transition-all">
                            View Full Context
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

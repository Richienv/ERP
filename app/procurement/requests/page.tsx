"use client"

import { useState } from "react"
import {
    Search,
    CheckCircle2,
    XCircle,
    Clock,
    MessageSquare,
    FileText,
    AlertTriangle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

// Mock Requests
const requests = [
    {
        id: "PR-2024-001",
        requester: "Budi Santoso",
        dept: "Production",
        item: "Sparepart Mesin Sewing Juki",
        amount: "Rp 2.500.000",
        date: "2 hours ago",
        urgency: "High",
        status: "Pending",
        notes: "Mesin Line 3 breakdown, butuh urgent.",
        initials: "BS"
    },
    {
        id: "PR-2024-002",
        requester: "Siti Aminah",
        dept: "Office",
        item: "Kertas A4 & Toner Printer",
        amount: "Rp 850.000",
        date: "1 day ago",
        urgency: "Normal",
        status: "Pending",
        notes: "Stok bulanan habis.",
        initials: "SA"
    },
    {
        id: "PR-2024-003",
        requester: "Rudi Hartono",
        dept: "Warehouse",
        item: "Safety Boots (5 pairs)",
        amount: "Rp 1.200.000",
        date: "2 days ago",
        urgency: "Low",
        status: "Pending",
        notes: "Untuk staff baru.",
        initials: "RH"
    }
]

export default function PurchaseRequestsPage() {
    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 font-sans">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black font-serif tracking-tight text-black flex items-center gap-2">
                        Permintaan Pembelian (PR)
                    </h2>
                    <p className="text-muted-foreground mt-1 font-medium">Inbox persetujuan pengadaan dari departemen internal.</p>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 bg-white p-2 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search requester, item..." className="pl-9 border-black focus-visible:ring-black font-medium" />
                </div>
            </div>

            {/* Inbox Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {requests.map((req) => (
                    <Card key={req.id} className="group border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] transition-all bg-white rounded-xl overflow-hidden">
                        <CardHeader className="flex-row items-start justify-between pb-2">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-12 w-12 border border-black">
                                    <AvatarFallback className="bg-black text-white font-bold">{req.initials}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="text-lg font-black uppercase leading-none">{req.requester}</h3>
                                    <p className="text-sm font-medium text-muted-foreground">{req.dept} Department</p>
                                </div>
                            </div>
                            <Badge variant={req.urgency === 'High' ? 'destructive' : 'outline'} className={`uppercase font-bold text-[10px] ${req.urgency !== 'High' && 'border-black text-black'}`}>{req.urgency} Priority</Badge>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            <div className="bg-zinc-50 p-3 rounded-lg border border-dashed border-zinc-300">
                                <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Requesting</p>
                                <p className="text-lg font-bold leading-tight">{req.item}</p>
                                <p className="text-sm font-black mt-2 text-emerald-600">{req.amount}</p>
                            </div>

                            <div className="flex gap-2 text-sm text-black/70 bg-amber-50 p-2 rounded border border-amber-100 items-start">
                                <MessageSquare className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                                <span className="italic">"{req.notes}"</span>
                            </div>
                        </CardContent>

                        <CardFooter className="pt-4 border-t border-black bg-zinc-50 flex gap-2">
                            <Button variant="outline" className="flex-1 border-black font-bold uppercase hover:bg-red-50 hover:text-red-600 hover:border-red-600 shadow-sm">
                                <XCircle className="mr-2 h-4 w-4" /> Reject
                            </Button>
                            <Button className="flex-1 bg-black text-white hover:bg-zinc-800 border border-black font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all">
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>

        </div>
    )
}

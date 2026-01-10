"use client"

import { useState } from "react"
import {
    Search,
    Plus,
    Filter,
    ArrowDownLeft,
    Wallet,
    Building,
    CreditCard,
    MoreHorizontal,
    RefreshCw,
    Link,
    Check,
    TrendingUp,
    ArrowRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter
} from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

// Mock Unallocated Payments
const unallocated = [
    { id: "PAY-991", from: "Batik Keris", amount: "Rp 15.000.000", date: "Today", method: "Transfer" },
    { id: "PAY-992", from: "Unknown (CASH)", amount: "Rp 2.500.000", date: "Yesterday", method: "Cash Deposit" },
    { id: "PAY-993", from: "Danar Hadi", amount: "Rp 45.000.000", date: "2 mins ago", method: "Transfer" }
]

// Mock Open Invoices
const openInvoices = [
    { id: "INV-201", customer: "Batik Keris", amount: "Rp 15.000.000", due: "Due Today" },
    { id: "INV-204", customer: "Danar Hadi", amount: "Rp 45.000.000", due: "Due Tomorrow" },
    { id: "INV-208", customer: "Agung Tex", amount: "Rp 8.200.000", due: "Overdue" }
]

export default function ARPymtMatcherPage() {
    const [matched, setMatched] = useState<string[]>([])

    const handleMatch = (payId: string) => {
        setMatched([...matched, payId])
    }

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 font-sans h-[calc(100vh-theme(spacing.16))] flex flex-col">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div>
                    <h2 className="text-3xl font-black font-serif tracking-tight text-black flex items-center gap-2">
                        AR Payment Stream
                    </h2>
                    <p className="text-muted-foreground mt-1 font-medium">Real-time cash entry & reconciliation game.</p>
                </div>
                <Button className="bg-emerald-600 text-white hover:bg-emerald-700 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide transition-all active:translate-y-1 active:shadow-none">
                    <Plus className="mr-2 h-4 w-4" /> Manual Cash Entry
                </Button>
            </div>

            {/* Live Ticker */}
            <div className="bg-black text-emerald-400 p-2 overflow-hidden flex items-center gap-8 font-mono text-sm font-bold border-y-2 border-emerald-500/50">
                <span className="flex items-center gap-2"><ArrowDownLeft className="h-4 w-4" /> PAY-993 RECEIVED: Rp 45.000.000 (Danar Hadi)</span>
                <span className="text-zinc-500">///</span>
                <span className="flex items-center gap-2"><ArrowDownLeft className="h-4 w-4" /> PAY-991 RECEIVED: Rp 15.000.000 (Batik Keris)</span>
                <span className="text-zinc-500">///</span>
                <span className="flex items-center gap-2 text-white"><TrendingUp className="h-4 w-4" /> DAILY TOTAL: Rp 128.5M (+15%)</span>
            </div>

            {/* The Matcher Arena */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-0">

                {/* Left: Unallocated Money Pool */}
                <Card className="border-2 border-black bg-zinc-100/50 flex flex-col overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)]">
                    <CardHeader className="bg-emerald-100 border-b-2 border-black pb-4">
                        <CardTitle className="font-black uppercase flex items-center gap-2 text-emerald-900">
                            <Wallet className="h-6 w-6" /> Unallocated Cash
                        </CardTitle>
                        <CardDescription className="text-emerald-800 font-bold">
                            Incoming payments needing invoices.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                        {unallocated.map((pay) => (
                            <div key={pay.id} className={`group bg-white border-2 border-black p-4 rounded-xl shadow-sm hover:translate-x-2 transition-all cursor-grab active:cursor-grabbing relative ${matched.includes(pay.id) ? 'opacity-50 grayscale' : ''}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <Badge variant="outline" className="font-black border-black bg-emerald-50 text-emerald-700">{pay.id}</Badge>
                                    <span className="text-xs font-bold text-muted-foreground uppercase">{pay.date}</span>
                                </div>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <h4 className="font-black text-lg">{pay.from}</h4>
                                        <p className="text-xs font-medium text-muted-foreground">{pay.method}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-2xl font-black text-emerald-600">{pay.amount}</span>
                                    </div>
                                </div>

                                {/* Drag Handle Visual */}
                                <div className="absolute -right-1 top-1/2 -translate-y-1/2 h-8 w-1 bg-zinc-300 rounded-full group-hover:bg-black transition-colors" />
                            </div>
                        ))}
                        <div className="h-20 border-2 border-dashed border-zinc-300 rounded-xl flex items-center justify-center text-zinc-400 font-bold uppercase">
                            Waiting for new transactions...
                        </div>
                    </CardContent>
                </Card>

                {/* Right: Open Invoices Target */}
                <Card className="border-2 border-black bg-white flex flex-col overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)]">
                    <CardHeader className="bg-zinc-100 border-b-2 border-black pb-4 relative overflow-hidden">
                        {/* "Hole" visual for dropping */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-200 rounded-bl-[100px] border-l-2 border-b-2 border-black opacity-50" />

                        <CardTitle className="font-black uppercase flex items-center gap-2">
                            <Building className="h-6 w-6" /> Invoice Targets
                        </CardTitle>
                        <CardDescription className="font-bold text-muted-foreground">
                            Match payments here to reconcile.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                        {openInvoices.map((inv) => (
                            <div key={inv.id} className="bg-zinc-50 border border-black/20 p-4 rounded-xl flex items-center justify-between hover:bg-zinc-100 transition-colors">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono font-bold text-xs">{inv.id}</span>
                                        <Badge variant="outline" className="text-[10px] border-black/20 h-5">{inv.due}</Badge>
                                    </div>
                                    <h4 className="font-bold text-sm">{inv.customer}</h4>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="font-black text-lg text-black/40">{inv.amount}</span>
                                    <Button
                                        size="sm"
                                        className="rounded-full bg-black text-white hover:bg-emerald-600 hover:scale-110 transition-all border border-black shadow-sm"
                                        onClick={() => handleMatch("PAY-991")} // Mock action
                                    >
                                        <Link className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                    <CardFooter className="bg-zinc-50 border-t-2 border-black p-4">
                        <Button className="w-full bg-emerald-600 text-white hover:bg-emerald-700 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-black py-6 text-lg tracking-widest active:translate-y-1 active:shadow-none transition-all">
                            <RefreshCw className="mr-2 h-5 w-5 animate-spin-slow" /> Auto-Match Intelligence
                        </Button>
                    </CardFooter>
                </Card>

            </div>

        </div>
    )
}

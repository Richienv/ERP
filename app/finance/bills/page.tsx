"use client"

import { useState } from "react"
import {
    Search,
    Plus,
    Filter,
    Receipt,
    AlertTriangle,
    CalendarClock,
    MoreVertical,
    Banknote,
    Stamp,
    CheckCircle2,
    XCircle,
    FileText
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
    Dialog,
    DialogContent,
    DialogTrigger,
} from "@/components/ui/dialog"

const pendingBills = [
    { id: "BILL-092", vendor: "Zhejiang Fabrics Ltd", date: "Jan 20", amount: "Rp 128.500.000", status: "Review", urgent: false },
    { id: "BILL-090", vendor: "PLN (Listrik)", date: "Jan 18", amount: "Rp 15.000.000", status: "Approved", urgent: true },
    { id: "BILL-089", vendor: "PT Textile Sejahtera", date: "Jan 22", amount: "Rp 50.000.000", status: "New", urgent: false },
]

export default function APBillsStackPage() {
    const [activeBill, setActiveBill] = useState(pendingBills[0])
    const [stamped, setStamped] = useState(false)

    const handleStamp = () => {
        setStamped(true)
        setTimeout(() => setStamped(false), 2000) // Reset for demo
    }

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 font-sans h-[calc(100vh-theme(spacing.16))] flex flex-col">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div>
                    <h2 className="text-3xl font-black font-serif tracking-tight text-black flex items-center gap-2">
                        Bills Approval Stack
                    </h2>
                    <p className="text-muted-foreground mt-1 font-medium">Review, Stamp, and Pay vendor invoices.</p>
                </div>
                <Button className="bg-red-600 text-white hover:bg-red-700 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide transition-all active:translate-y-1 active:shadow-none">
                    <Plus className="mr-2 h-4 w-4" /> Scan New Bill
                </Button>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0 items-start">

                {/* Left: The Stack (List) */}
                <div className="lg:col-span-4 space-y-4 overflow-y-auto h-full pr-2">
                    <h3 className="font-black uppercase text-sm text-zinc-500 mb-2">Pending Review ({pendingBills.length})</h3>
                    {pendingBills.map((bill) => (
                        <div
                            key={bill.id}
                            onClick={() => { setActiveBill(bill); setStamped(false); }}
                            className={`group cursor-pointer relative ${bill.id === activeBill.id ? 'z-10' : 'z-0'}`}
                        >
                            <Card className={`border-2 transition-all ${bill.id === activeBill.id ? 'border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] translate-x-2' : 'border-black/10 bg-zinc-50 hover:bg-white hover:border-black/50'}`}>
                                {bill.urgent && (
                                    <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rotate-12 shadow-sm z-20">
                                        Overdue
                                    </div>
                                )}
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="outline" className="font-mono font-bold text-[10px]">{bill.id}</Badge>
                                        <span className="text-xs font-bold text-muted-foreground">{bill.date}</span>
                                    </div>
                                    <h4 className="font-black text-sm truncate">{bill.vendor}</h4>
                                    <p className="text-lg font-bold text-black/80">{bill.amount}</p>
                                </CardContent>
                            </Card>
                        </div>
                    ))}
                </div>

                {/* Right: The Active Bill (Detail & Stamp Area) */}
                <div className="lg:col-span-8 h-full flex flex-col">
                    <Card className="flex-1 border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] bg-white relative overflow-hidden flex flex-col">

                        {/* Background Pattern */}
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                        <div className="p-8 flex-1 relative z-10">
                            {/* Stamp Animation */}
                            {stamped && (
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-in zoom-in-50 duration-300">
                                    <div className="border-8 border-emerald-600 text-emerald-600 font-black text-6xl uppercase px-8 py-4 -rotate-12 opacity-80 mix-blend-multiply tracking-widest">
                                        APPROVED
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-6">
                                <div>
                                    <h1 className="text-4xl font-black font-serif uppercase tracking-tighter">{activeBill.vendor}</h1>
                                    <p className="text-lg font-medium text-zinc-500 mt-1">Invoice #{activeBill.id} • Due {activeBill.date}, 2024</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold uppercase text-zinc-400">Total Amount</p>
                                    <p className="text-5xl font-black tracking-tighter mt-1">{activeBill.amount}</p>
                                </div>
                            </div>

                            {/* Bill Items Mockup */}
                            <div className="space-y-4 max-w-2xl">
                                <div className="flex justify-between text-sm font-bold border-b border-black/10 pb-2">
                                    <span>Description</span>
                                    <span>Amount</span>
                                </div>
                                <div className="flex justify-between py-2 text-lg font-medium border-b border-dashed border-zinc-200">
                                    <span>Fabric Cotton 30s (200 Rolls)</span>
                                    <span>Rp 100.000.000</span>
                                </div>
                                <div className="flex justify-between py-2 text-lg font-medium border-b border-dashed border-zinc-200">
                                    <span>Shipping Fee (Trucking)</span>
                                    <span>Rp 28.500.000</span>
                                </div>
                            </div>
                        </div>

                        {/* Action Footer */}
                        <div className="bg-zinc-100 p-6 border-t-4 border-black flex items-center justify-between gap-6 relative z-20">
                            <div className="flex gap-4">
                                <Button variant="outline" className="h-14 px-8 border-2 border-zinc-300 text-zinc-500 hover:border-red-500 hover:text-red-600 uppercase font-black text-lg">
                                    <XCircle className="mr-2 h-6 w-6" /> Dispute
                                </Button>
                            </div>
                            <div className="flex gap-4">
                                <Button
                                    onClick={handleStamp}
                                    className="h-14 px-10 bg-black text-white hover:bg-emerald-600 hover:scale-105 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-black text-xl tracking-widest transition-all active:translate-y-1 active:shadow-none"
                                >
                                    <Stamp className="mr-3 h-6 w-6" /> APPROVE
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

        </div>
    )
}

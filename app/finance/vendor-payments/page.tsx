"use client"

import { useState } from "react"
import {
    Search,
    Plus,
    Filter,
    ArrowUpRight,
    TrendingUp,
    CreditCard,
    Banknote,
    MoreHorizontal,
    PenTool,
    Lock,
    ChevronRight,
    History
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
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

export default function APCheckbookPage() {
    const [payee, setPayee] = useState("")
    const [amount, setAmount] = useState("")
    const [isSigned, setIsSigned] = useState(false)

    const handleSign = () => {
        if (payee && amount) setIsSigned(true)
    }

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 font-sans h-[calc(100vh-theme(spacing.16))] flex flex-col">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div>
                    <h2 className="text-3xl font-black font-serif tracking-tight text-black flex items-center gap-2">
                        Payment Checkbook
                    </h2>
                    <p className="text-muted-foreground mt-1 font-medium">Securely issue checks and bank transfers.</p>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0 items-start">

                {/* Left: Checkbook Interface */}
                <div className="lg:col-span-7 space-y-6">

                    {/* Visual Check */}
                    <Card className="border-4 border-black bg-[#fdfdfd] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
                        {/* Security Pattern */}
                        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4a5568 1px, transparent 1px)', backgroundSize: '10px 10px' }} />

                        {/* Left Stub */}
                        <div className="absolute left-0 top-0 bottom-0 w-16 border-r-2 border-dashed border-zinc-300 bg-zinc-50/50 hidden md:block" />

                        <CardContent className="p-8 md:pl-24 relative z-10 space-y-8">
                            {/* Top Bank Info */}
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2 text-zinc-400 font-bold uppercase tracking-widest text-xs">
                                    <Banknote className="h-4 w-4" /> Secure Bank Transfer
                                </div>
                                <div className="font-mono text-xl font-black tracking-widest text-black/20">NO. 0004592</div>
                            </div>

                            {/* Payee Line */}
                            <div className="flex items-end gap-4 relative">
                                <Label className="uppercase font-bold text-xs w-24 shrink-0 pb-2">Pay To The Order Of</Label>
                                <div className="flex-1 border-b-2 border-black/20 relative">
                                    <Input
                                        value={payee}
                                        onChange={(e) => setPayee(e.target.value)}
                                        className="border-0 shadow-none focus-visible:ring-0 bg-transparent font-serif text-2xl font-bold px-0 h-auto placeholder:text-zinc-200"
                                        placeholder="Enter Vendor Name..."
                                    />
                                    {/* Handwriting Font Effect would go here */}
                                </div>
                                <div className="w-48 border-2 border-black/10 bg-zinc-50 p-2 rounded flex items-center gap-1">
                                    <span className="font-bold text-zinc-400">Rp</span>
                                    <Input
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="border-0 shadow-none focus-visible:ring-0 bg-transparent font-mono text-xl font-black px-0 h-auto text-right"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            {/* Memo Line */}
                            <div className="flex items-end gap-4">
                                <Label className="uppercase font-bold text-xs w-12 shrink-0 pb-2">Memo</Label>
                                <div className="flex-1 border-b-2 border-black/20">
                                    <Input className="border-0 shadow-none focus-visible:ring-0 bg-transparent font-medium px-0 h-auto" placeholder="Invoice # REF..." />
                                </div>
                            </div>

                            {/* Signature Line */}
                            <div className="flex justify-end pt-8">
                                <div className="w-64 border-b-2 border-black relative">
                                    {isSigned ? (
                                        <div className="absolute bottom-2 left-0 right-0 text-center font-serif italic text-3xl text-blue-900 animate-in zoom-in spin-in-3 duration-500">
                                            Authorized Sign.
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleSign}
                                            className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/5 transition-opacity text-xs font-bold uppercase cursor-pointer"
                                        >
                                            Click to Sign
                                        </button>
                                    )}
                                    <Label className="absolute -bottom-6 right-0 text-xs font-bold uppercase text-muted-foreground w-full text-center">Authorized Signature</Label>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Button
                        disabled={!isSigned}
                        className={`w-full h-16 text-xl uppercase font-black tracking-widest transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-1 ${isSigned ? 'bg-black text-white hover:bg-emerald-600' : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'}`}
                    >
                        {isSigned ? <span className="flex items-center gap-2">Processing Payment <ChevronRight className="h-6 w-6" /></span> : 'Sign Check to Continue'}
                    </Button>
                </div>

                {/* Right: History Log */}
                <div className="lg:col-span-5 border bg-white border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden flex flex-col h-[500px]">
                    <div className="bg-zinc-100 p-4 border-b border-black flex items-center justify-between">
                        <h3 className="font-black uppercase text-sm flex items-center gap-2"><History className="h-4 w-4" /> Check Register</h3>
                        <Badge className="bg-black text-white">Recent</Badge>
                    </div>
                    <div className="overflow-y-auto flex-1 p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent bg-zinc-50/50">
                                    <TableHead className="font-bold text-black uppercase text-xs w-[80px]">Chk #</TableHead>
                                    <TableHead className="font-bold text-black uppercase text-xs">Payee</TableHead>
                                    <TableHead className="text-right font-bold text-black uppercase text-xs">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <TableRow key={i} className="hover:bg-zinc-50 border-b border-black/5">
                                        <TableCell className="font-mono text-xs text-muted-foreground">00045{90 - i}</TableCell>
                                        <TableCell className="font-bold text-sm">Vendor Name {i}</TableCell>
                                        <TableCell className="text-right font-mono font-medium text-red-600">- Rp 1{i}.500.000</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>

            </div>

        </div>
    )
}

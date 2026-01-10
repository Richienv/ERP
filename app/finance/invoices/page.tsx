"use client"

import { useState } from "react"
import {
    Search,
    Plus,
    Filter,
    MoreVertical,
    Send,
    Stamp,
    CheckCircle2,
    AlertTriangle,
    FileText,
    Clock,
    Download,
    Printer,
    Mail,
    PenTool,
    Sparkles,
    ArrowRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

// Mock Data for Kanban
const initialInvoices = {
    draft: [
        { id: "INV-005", customer: "Indo Garment", amount: "Rp 72.800.000", date: "2024-01-20" },
        { id: "INV-006", customer: "New Client A", amount: "Rp 15.000.000", date: "2024-01-21" }
    ],
    sent: [
        { id: "INV-001", customer: "Batik Keris Utama", amount: "Rp 125.000.000", due: "2024-02-15" },
        { id: "INV-004", customer: "Agung Tex", amount: "Rp 45.000.000", due: "2024-02-05" }
    ],
    overdue: [
        { id: "INV-003", customer: "Sritex Tbk", amount: "Rp 210.000.000", due: "2024-01-10", daysOver: 5 }
    ],
    paid: [
        { id: "INV-002", customer: "Danar Hadi Group", amount: "Rp 85.500.000", date: "2024-01-12" }
    ]
}

export default function InvoicesKanbanPage() {
    const [invoices, setInvoices] = useState(initialInvoices)
    const [isCreatorOpen, setIsCreatorOpen] = useState(false)

    // Smart Creator State
    const [stamp, setStamp] = useState("none")
    const [signature, setSignature] = useState("digital")
    const [autoSend, setAutoSend] = useState(false)

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 font-sans h-[calc(100vh-theme(spacing.16))] flex flex-col">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div>
                    <h2 className="text-3xl font-black font-serif tracking-tight text-black flex items-center gap-2">
                        Invoice Command Center
                    </h2>
                    <p className="text-muted-foreground mt-1 font-medium">Kanban flow & otomatisasi penagihan.</p>
                </div>

                <Dialog open={isCreatorOpen} onOpenChange={setIsCreatorOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide transition-all active:translate-y-1 active:shadow-none h-12 px-6">
                            <Sparkles className="mr-2 h-4 w-4 text-emerald-400" /> Smart Invoice Creator
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 overflow-hidden bg-white">
                        <DialogHeader className="p-6 pb-2 border-b border-black/10 bg-zinc-50">
                            <DialogTitle className="text-2xl font-black uppercase flex items-center gap-2">
                                <FileText className="h-6 w-6" /> Create Smart Invoice
                            </DialogTitle>
                            <DialogDescription className="font-medium text-black/60">
                                Configure automation rules and visual elements.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Left: Data Input */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="uppercase font-bold text-xs">Customer</Label>
                                    <Select>
                                        <SelectTrigger className="border-black font-medium h-10 shadow-sm">
                                            <SelectValue placeholder="Select Customer" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="c1">Batik Keris Utama</SelectItem>
                                            <SelectItem value="c2">Danar Hadi Group</SelectItem>
                                            <SelectItem value="c3">Sritex Tbk</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="uppercase font-bold text-xs">Issue Date</Label>
                                        <Input type="date" className="border-black font-medium h-10 shadow-sm" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="uppercase font-bold text-xs">Due Date</Label>
                                        <Input type="date" className="border-black font-medium h-10 shadow-sm" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="uppercase font-bold text-xs">Items Total</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">Rp</span>
                                        <Input className="pl-9 border-black font-black h-10 shadow-sm" placeholder="0" />
                                    </div>
                                </div>
                            </div>

                            {/* Right: Smart Features */}
                            <div className="space-y-6 bg-zinc-50 p-4 rounded-xl border border-black/10">
                                <div className="space-y-3">
                                    <Label className="uppercase font-bold text-xs flex items-center gap-2">
                                        <Stamp className="h-4 w-4" /> Visual Stamp
                                    </Label>
                                    <RadioGroup value={stamp} onValueChange={setStamp} className="grid grid-cols-3 gap-2">
                                        <div>
                                            <RadioGroupItem value="none" id="s1" className="peer sr-only" />
                                            <Label htmlFor="s1" className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-black peer-data-[state=checked]:bg-white cursor-pointer transition-all">
                                                <span className="text-[10px] font-bold uppercase">None</span>
                                            </Label>
                                        </div>
                                        <div>
                                            <RadioGroupItem value="urgent" id="s2" className="peer sr-only" />
                                            <Label htmlFor="s2" className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-2 hover:bg-red-50 hover:text-red-600 peer-data-[state=checked]:border-red-600 peer-data-[state=checked]:bg-red-50 cursor-pointer transition-all">
                                                <span className="text-[10px] font-bold uppercase text-red-600">Urgent</span>
                                            </Label>
                                        </div>
                                        <div>
                                            <RadioGroupItem value="confidential" id="s3" className="peer sr-only" />
                                            <Label htmlFor="s3" className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-2 hover:bg-zinc-100 peer-data-[state=checked]:border-black peer-data-[state=checked]:bg-black peer-data-[state=checked]:text-white cursor-pointer transition-all">
                                                <span className="text-[10px] font-bold uppercase">Secret</span>
                                            </Label>
                                        </div>
                                    </RadioGroup>
                                </div>

                                <div className="space-y-3">
                                    <Label className="uppercase font-bold text-xs flex items-center gap-2">
                                        <PenTool className="h-4 w-4" /> Digital Signature
                                    </Label>
                                    <Select value={signature} onValueChange={setSignature}>
                                        <SelectTrigger className="border-black font-medium h-10 shadow-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="digital">Digital Cert (Secure)</SelectItem>
                                            <SelectItem value="manual">Upload Scanned Image</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-black/10">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-bold">Auto-Send Email</Label>
                                        <p className="text-[10px] text-muted-foreground">Send immediately upon creation.</p>
                                    </div>
                                    <Switch checked={autoSend} onCheckedChange={setAutoSend} className="data-[state=checked]:bg-emerald-500" />
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="p-6 pt-2 border-t border-black/10 bg-zinc-50 flex gap-2">
                            <Button variant="outline" className="border-black uppercase font-bold" onClick={() => setIsCreatorOpen(false)}>Cancel</Button>
                            <Button className="bg-black text-white hover:bg-zinc-800 border-black uppercase font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[2px] transition-all">
                                Create & Process
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Kanban Board */}
            <div className="flex-1 overflow-x-auto pb-4">
                <div className="flex gap-6 h-full min-w-[1000px]">

                    {/* 1. Draft */}
                    <div className="w-1/4 bg-zinc-100/50 rounded-2xl p-4 border border-black/5 flex flex-col gap-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-black/10">
                            <div className="h-3 w-3 rounded-full bg-zinc-400" />
                            <h3 className="font-black uppercase text-sm text-zinc-600">Drafts</h3>
                            <Badge variant="outline" className="ml-auto border-zinc-300 bg-white text-xs">{invoices.draft.length}</Badge>
                        </div>
                        {invoices.draft.map((inv) => (
                            <Card key={inv.id} className="cursor-grab active:cursor-grabbing border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all bg-white group">
                                <CardHeader className="p-4 pb-2 flex-row justify-between items-start space-y-0">
                                    <span className="font-mono text-xs font-bold text-muted-foreground">{inv.id}</span>
                                    <MoreVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <h4 className="font-bold text-sm mb-1">{inv.customer}</h4>
                                    <p className="text-lg font-black">{inv.amount}</p>
                                </CardContent>
                                <CardFooter className="p-4 pt-0 text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> Created {inv.date}
                                </CardFooter>
                            </Card>
                        ))}
                        <Button variant="ghost" className="w-full border border-dashed border-zinc-300 text-zinc-400 hover:text-black hover:border-black uppercase font-bold text-xs">
                            + Quick Draft
                        </Button>
                    </div>

                    {/* 2. Sent */}
                    <div className="w-1/4 bg-blue-50/50 rounded-2xl p-4 border border-blue-100 flex flex-col gap-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-blue-200">
                            <div className="h-3 w-3 rounded-full bg-blue-500" />
                            <h3 className="font-black uppercase text-sm text-blue-700">Sent to Client</h3>
                            <Badge variant="outline" className="ml-auto border-blue-200 bg-white text-blue-700 text-xs">{invoices.sent.length}</Badge>
                        </div>
                        {invoices.sent.map((inv) => (
                            <Card key={inv.id} className="cursor-grab active:cursor-grabbing border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all bg-white relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-1 bg-blue-500 text-white rounded-bl-lg">
                                    <Mail className="h-3 w-3" />
                                </div>
                                <CardHeader className="p-4 pb-2">
                                    <span className="font-mono text-xs font-bold text-blue-600">{inv.id}</span>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <h4 className="font-bold text-sm mb-1">{inv.customer}</h4>
                                    <p className="text-lg font-black">{inv.amount}</p>
                                </CardContent>
                                <CardFooter className="p-4 pt-0 text-[10px] font-bold text-blue-600/70 flex items-center gap-1">
                                    Due: {inv.due}
                                </CardFooter>
                            </Card>
                        ))}
                    </div>

                    {/* 3. Overdue */}
                    <div className="w-1/4 bg-red-50/50 rounded-2xl p-4 border border-red-100 flex flex-col gap-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-red-200">
                            <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                            <h3 className="font-black uppercase text-sm text-red-700">Overdue</h3>
                            <Badge variant="outline" className="ml-auto border-red-200 bg-red-100 text-red-700 text-xs">{invoices.overdue.length}</Badge>
                        </div>
                        {invoices.overdue.map((inv) => (
                            <Card key={inv.id} className="cursor-grab active:cursor-grabbing border-2 border-red-600 shadow-[4px_4px_0px_0px_rgba(220,38,38,0.3)] hover:shadow-[2px_2px_0px_0px_rgba(220,38,38,0.5)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all bg-white relative overflow-hidden group">
                                {/* Overdue Stamp */}
                                <div className="absolute -right-2 top-4 rotate-12 border-2 border-red-600 px-2 py-1 rounded opacity-30 group-hover:opacity-100 transition-opacity">
                                    <span className="text-[10px] font-black text-red-600 uppercase">LATE</span>
                                </div>

                                <CardHeader className="p-4 pb-2">
                                    <span className="font-mono text-xs font-bold text-red-600">{inv.id}</span>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <h4 className="font-bold text-sm mb-1">{inv.customer}</h4>
                                    <p className="text-lg font-black text-red-700">{inv.amount}</p>
                                </CardContent>
                                <CardFooter className="p-4 pt-0 text-[10px] font-bold text-red-600 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" /> {inv.daysOver} Days Late
                                </CardFooter>
                            </Card>
                        ))}
                    </div>

                    {/* 4. Paid */}
                    <div className="w-1/4 bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100 flex flex-col gap-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-emerald-200">
                            <div className="h-3 w-3 rounded-full bg-emerald-500" />
                            <h3 className="font-black uppercase text-sm text-emerald-700">Paid</h3>
                            <Badge variant="outline" className="ml-auto border-emerald-200 bg-white text-emerald-700 text-xs">{invoices.paid.length}</Badge>
                        </div>
                        {invoices.paid.map((inv) => (
                            <Card key={inv.id} className="cursor-grab active:cursor-grabbing border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all bg-zinc-50 opacity-80 hover:opacity-100 overflow-hidden">
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-10">
                                    <CheckCircle2 className="h-16 w-16 text-emerald-600" />
                                </div>
                                <CardHeader className="p-4 pb-2">
                                    <span className="font-mono text-xs font-bold text-emerald-700">{inv.id}</span>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <h4 className="font-bold text-sm mb-1">{inv.customer}</h4>
                                    <p className="text-lg font-black text-emerald-800">{inv.amount}</p>
                                </CardContent>
                                <CardFooter className="p-4 pt-0 text-[10px] font-bold text-emerald-600/70 flex items-center gap-1">
                                    Received {inv.date}
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>

        </div>
    )
}

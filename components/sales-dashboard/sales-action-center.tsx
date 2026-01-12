"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, FileText, ShoppingBag, AlertCircle, Clock, CheckCircle2, XCircle, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useState } from "react"

export function SalesActionCenter() {
    return (
        <Card className="col-span-1 md:col-span-3 lg:col-span-2 h-full border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white">
            <CardHeader className="pb-3 border-b border-black bg-zinc-50 dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
                        <FileText className="h-5 w-5 text-black" />
                        To-Do Sales
                    </CardTitle>
                    <Badge variant="outline" className="text-xs font-bold bg-white text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] px-2 py-1">
                        8 Tasks
                    </Badge>
                </div>
                <CardDescription className="font-medium text-black/60">Aksi prioritas hari ini</CardDescription>
            </CardHeader>
            <CardContent className="p-4 overflow-y-auto max-h-[500px]">
                <div className="space-y-6">
                    {/* Quotations Section */}
                    <div>
                        <h4 className="font-black text-[10px] text-muted-foreground uppercase tracking-widest mb-3 border-b border-black/10 pb-1">Penawaran (Quotations)</h4>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between group cursor-pointer hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none p-3 rounded-lg transition-all border border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                <div className="flex items-center gap-3">
                                    <div className="h-3 w-3 rounded-sm border border-black bg-orange-500" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold uppercase">PT. Garment Indah</span>
                                        <span className="text-[10px] font-mono text-muted-foreground">Sent 3 days ago • Rp 450 Jt</span>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded border border-black hover:bg-black hover:text-white transition-colors">
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="flex items-center justify-between group cursor-pointer hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none p-3 rounded-lg transition-all border border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                <div className="flex items-center gap-3">
                                    <div className="h-3 w-3 rounded-sm border border-black bg-red-600" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold uppercase">CV. Maju Jaya</span>
                                        <span className="text-[10px] font-mono text-muted-foreground">Expires tomorrow • Rp 120 Jt</span>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded border border-black hover:bg-black hover:text-white transition-colors">
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Sales Orders Section */}
                    <div>
                        <h4 className="font-black text-[10px] text-muted-foreground uppercase tracking-widest mb-3 border-b border-black/10 pb-1">Sales Orders (SO)</h4>
                        <div className="space-y-2">

                            {/* APPROVAL DIALOG ITEM */}
                            <OrderApprovalDialog />

                        </div>
                    </div>

                    {/* Invoicing Section */}
                    <div>
                        <h4 className="font-black text-[10px] text-muted-foreground uppercase tracking-widest mb-3 border-b border-black/10 pb-1">Billing & Invoicing</h4>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between group cursor-pointer hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none p-3 rounded-lg transition-all border border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                <div className="flex items-center gap-3">
                                    <AlertCircle className="h-4 w-4 text-blue-600" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold uppercase">Siap Invoice</span>
                                        <span className="text-[10px] font-mono text-muted-foreground">3 Pengiriman Terkonfirmasi</span>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded border border-black hover:bg-black hover:text-white transition-colors">
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function OrderApprovalDialog() {
    const [isOpen, setIsOpen] = useState(false);
    const [actionState, setActionState] = useState<'idle' | 'rejecting' | 'approving'>('idle');

    return (
        <Dialog open={isOpen} onOpenChange={(v) => { setIsOpen(v); if (!v) setActionState('idle'); }}>
            <DialogTrigger asChild>
                <div className="flex items-center justify-between group cursor-pointer hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none p-3 rounded-lg transition-all border border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                    <div className="flex items-center gap-3">
                        <ShoppingBag className="h-4 w-4 text-purple-600" />
                        <div className="flex flex-col">
                            <span className="text-sm font-bold uppercase">Approval: Order Besar</span>
                            <span className="text-[10px] font-mono text-muted-foreground">#SO-099 • Margin 8% (Low)</span>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded border border-black hover:bg-black hover:text-white transition-colors">
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </div>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[500px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 gap-0 bg-white">
                <DialogHeader className="p-6 border-b border-black bg-zinc-50">
                    <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="bg-purple-100 text-purple-800 border-black">APPROVAL REQUIRED</Badge>
                        <span className="font-mono text-zinc-500 font-bold">#SO-099</span>
                    </div>
                    <DialogTitle className="text-xl font-black uppercase leading-tight">Order Besar - PT. Maju Sentosa</DialogTitle>
                    <DialogDescription>Total Value: Rp 1.250.000.000</DialogDescription>
                </DialogHeader>

                {actionState === 'idle' && (
                    <div className="p-6 space-y-6">
                        <div className="bg-amber-50 p-4 border border-amber-200 rounded-lg flex gap-3 text-amber-800">
                            <ShieldAlert className="h-5 w-5 flex-shrink-0" />
                            <div className="text-xs font-medium space-y-1">
                                <p className="font-bold">Low Margin Warning</p>
                                <p>Profit margin is 8% (Target: 15%). Requires Manager override to proceed.</p>
                            </div>
                        </div>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between py-1 border-b border-black/5">
                                <span className="text-muted-foreground">Customer</span>
                                <span className="font-bold">PT. Maju Sentosa</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-black/5">
                                <span className="text-muted-foreground">Items</span>
                                <span className="font-bold">5000 pcs Premium Cotton</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-black/5">
                                <span className="text-muted-foreground">Payment Term</span>
                                <span className="font-bold">NET 60 Days</span>
                            </div>
                        </div>
                    </div>
                )}

                {actionState === 'approving' && (
                    <div className="p-6 space-y-4 bg-emerald-50/50">
                        <div className="flex flex-col items-center text-center space-y-2">
                            <CheckCircle2 className="h-12 w-12 text-emerald-600 mb-2" />
                            <h4 className="text-lg font-black uppercase text-emerald-800">Safety Check</h4>
                            <p className="text-sm text-emerald-700 font-medium">Are you sure you want to approve this order despite the low margin?</p>
                        </div>
                        <div className="bg-white p-3 rounded border border-emerald-200 text-xs text-muted-foreground text-center">
                            Action logged by: <strong>Manager</strong> at {new Date().toLocaleTimeString()}
                        </div>
                    </div>
                )}

                {actionState === 'rejecting' && (
                    <div className="p-6 space-y-4 bg-red-50/50">
                        <div className="space-y-2">
                            <Label className="text-red-800 font-bold uppercase text-xs">Reason for Rejection</Label>
                            <Textarea placeholder="Please explain why this order is rejected..." className="bg-white border-red-200 focus:border-red-500 min-h-[100px]" />
                        </div>
                        <p className="text-xs text-red-600 font-medium">* This reason will be sent to the Sales Team.</p>
                    </div>
                )}

                <DialogFooter className="p-6 border-t border-black bg-zinc-50 flex-col sm:flex-row gap-3">
                    {actionState === 'idle' && (
                        <>
                            <Button variant="outline" onClick={() => setActionState('rejecting')} className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold">Reject Order</Button>
                            <Button onClick={() => setActionState('approving')} className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold">Approve Order</Button>
                        </>
                    )}
                    {actionState === 'approving' && (
                        <>
                            <Button variant="ghost" onClick={() => setActionState('idle')} className="font-bold">Cancel</Button>
                            <Button onClick={() => setIsOpen(false)} className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold">CONFIRM APPROVAL</Button>
                        </>
                    )}
                    {actionState === 'rejecting' && (
                        <>
                            <Button variant="ghost" onClick={() => setActionState('idle')} className="font-bold">Cancel</Button>
                            <Button onClick={() => setIsOpen(false)} className="flex-1 bg-red-600 text-white hover:bg-red-700 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold">CONFIRM REJECTION</Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

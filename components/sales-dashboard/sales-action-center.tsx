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
        <Card className="col-span-1 md:col-span-3 lg:col-span-2 h-full border-l-4 border-l-emerald-500 shadow-sm">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <FileText className="h-5 w-5 text-emerald-600" />
                        To-Do Sales
                    </CardTitle>
                    <span className="text-xs text-muted-foreground bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">
                        8 Tasks
                    </span>
                </div>
                <CardDescription>Aksi prioritas hari ini</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {/* Quotations Section */}
                    <div>
                        <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">Penawaran (Quotations)</h4>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between group cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 p-2 rounded transition-colors border border-dashed border-zinc-200 dark:border-zinc-800">
                                <div className="flex items-center gap-3">
                                    <div className="h-2 w-2 rounded-full bg-orange-500" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">Follow-up PT. Garment Indah</span>
                                        <span className="text-xs text-muted-foreground">Sent 3 days ago • Rp 450 Jt</span>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="flex items-center justify-between group cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 p-2 rounded transition-colors border border-dashed border-zinc-200 dark:border-zinc-800">
                                <div className="flex items-center gap-3">
                                    <div className="h-2 w-2 rounded-full bg-red-500" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">Expiring: CV. Maju Jaya</span>
                                        <span className="text-xs text-muted-foreground">Expires tomorrow • Rp 120 Jt</span>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Sales Orders Section */}
                    <div>
                        <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">Sales Orders (SO)</h4>
                        <div className="space-y-2">

                            {/* APPROVAL DIALOG ITEM */}
                            <OrderApprovalDialog />

                        </div>
                    </div>

                    {/* Invoicing Section */}
                    <div>
                        <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">Billing & Invoicing</h4>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between group cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 p-2 rounded transition-colors border border-dashed border-zinc-200 dark:border-zinc-800">
                                <div className="flex items-center gap-3">
                                    <AlertCircle className="h-4 w-4 text-blue-500" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">Siap Invoice: 3 Pengiriman</span>
                                        <span className="text-xs text-muted-foreground">Barang sudah diterima customer</span>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-6 w-6">
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
                <div className="flex items-center justify-between group cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 p-2 rounded transition-colors border border-dashed border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <ShoppingBag className="h-4 w-4 text-purple-500" />
                        <div className="flex flex-col">
                            <span className="text-sm font-medium">Approval: Order Besar #SO-099</span>
                            <span className="text-xs text-muted-foreground">Margin rendah (8%) • Memerlukan persetujuan</span>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 bg-purple-50 text-purple-600 hover:bg-purple-100 hover:text-purple-700">
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

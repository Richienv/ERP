"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, FileText, ShoppingBag, AlertCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"

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

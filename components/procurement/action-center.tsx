import { AlertCircle, ArrowRight, CheckCircle2, Clock, FileText, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function ActionCenter() {
    return (
        <Card className="col-span-1 md:col-span-3 lg:col-span-4 border-l-4 border-l-blue-500 shadow-sm">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        Tugas Hari Ini (Action Items)
                    </CardTitle>
                    <span className="text-sm text-muted-foreground">Senin, 14 Jan 2026</span>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* RFQ Section */}
                    <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800">
                        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-2">Permintaan (RFQ)</h4>

                        <div className="flex items-center justify-between group cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 p-2 rounded transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs ring-2 ring-white dark:ring-zinc-950">
                                    5
                                </div>
                                <span className="text-sm font-medium">Permintaan Baru</span>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>

                        <div className="flex items-center justify-between group cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 p-2 rounded transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-xs ring-2 ring-white dark:ring-zinc-950">
                                    3
                                </div>
                                <span className="text-sm font-medium">RFQ Perlu Dikirim</span>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </div>

                    {/* PO Section */}
                    <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800">
                        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-2">Purchase Order (PO)</h4>

                        <div className="flex items-center justify-between group cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 p-2 rounded transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs ring-2 ring-white dark:ring-zinc-950">
                                    2
                                </div>
                                <span className="text-sm font-medium">Menunggu Approval</span>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>

                        <div className="flex items-center justify-between group cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 p-2 rounded transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-xs ring-2 ring-white dark:ring-zinc-950">
                                    1
                                </div>
                                <span className="text-sm font-medium text-rose-600">Terlambat Kirim</span>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </div>

                    {/* Invoice Section */}
                    <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800">
                        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-2">Tagihan & Validasi</h4>

                        <div className="flex items-center justify-between group cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 p-2 rounded transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center font-bold text-xs ring-2 ring-white dark:ring-zinc-950">
                                    4
                                </div>
                                <span className="text-sm font-medium">Bill Belum Validasi</span>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>

                        <div className="flex items-center justify-between group cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 p-2 rounded transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-zinc-200 text-zinc-600 flex items-center justify-center font-bold text-xs ring-2 ring-white dark:ring-zinc-950">
                                    0
                                </div>
                                <span className="text-sm font-medium text-muted-foreground">Missing Invoice</span>
                            </div>
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 opacity-100" />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

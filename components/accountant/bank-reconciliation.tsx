"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, AlertCircle, ArrowRight } from "lucide-react"

export function BankReconciliation() {
    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>Rekonsiliasi Bank Cerdas</span>
                    <span className="text-sm font-normal text-muted-foreground">BCA - 1234567890</span>
                </CardTitle>
                <CardDescription>Pencocokan transaksi otomatis dengan AI</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-6">
                {/* Progress Stats */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Status Rekonsiliasi (Jan 2026)</span>
                        <span className="font-medium">91% Selesai</span>
                    </div>
                    <Progress value={91} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground pt-1">
                        <span>134 Cocok Otomatis</span>
                        <span className="text-orange-500 font-medium">13 Perlu Review</span>
                    </div>
                </div>

                {/* AI Match Card */}
                <div className="border rounded-xl overflow-hidden bg-zinc-50 dark:bg-zinc-900/50 flex-1 flex flex-col">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/50 flex items-center gap-2">
                        <div className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">AI MATCH</div>
                        <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">Confidence Score: 95%</span>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-center gap-4">
                        <div className="flex justify-between items-center">
                            <div className="text-left">
                                <div className="text-xs text-muted-foreground mb-1">Transaksi Bank</div>
                                <div className="font-bold">Rp 95.750.000</div>
                                <div className="text-xs text-muted-foreground mt-1">TRSF CV GARMEN</div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <div className="text-right">
                                <div className="text-xs text-muted-foreground mb-1">Invoice ERP</div>
                                <div className="font-bold">Rp 95.000.000</div>
                                <div className="text-xs text-muted-foreground mt-1">INV-2687 (CV Garmen)</div>
                            </div>
                        </div>

                        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-100 dark:border-orange-900/50 flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5" />
                            <div className="text-xs text-zinc-700 dark:text-zinc-300">
                                <span className="font-semibold text-orange-600 dark:text-orange-400">Selisih +Rp 750.000</span>
                                <p className="mt-0.5">Kemungkinan biaya admin bank atau pembulatan. AI menyarankan untuk mencatat sebagai 'Bank Charges'.</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-3 border-t bg-white dark:bg-black flex gap-2">
                        <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-xs" size="sm">
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                            Terima & Sesuaikan
                        </Button>
                        <Button variant="outline" className="flex-1 h-9 text-xs hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" size="sm">
                            <XCircle className="mr-1.5 h-3.5 w-3.5" />
                            Tolak
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react"

export function ImpactAnalyzer() {
    return (
        <Card className="border-blue-200 dark:border-blue-900 bg-white dark:bg-black">
            <CardHeader className="bg-blue-50 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900 pb-4">
                <CardTitle className="text-base text-blue-950 dark:text-blue-100 flex items-center gap-2">
                    <AlertOctagon className="h-5 w-5 text-blue-600" />
                    Change Impact Analysis (Simulasi Dampak)
                </CardTitle>
                <CardDescription className="text-blue-800/70 dark:text-blue-200/60">
                    Pratinjau dampak perubahan Master Data sebelum dieksekusi
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">

                {/* Context */}
                <div className="flex items-center gap-4 text-sm bg-muted p-3 rounded-lg border">
                    <div className="font-semibold w-24 shrink-0 text-muted-foreground">Proposed Change:</div>
                    <div className="flex items-center gap-2 font-medium">
                        <span>Supplier "PT Logam Jaya"</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span className="underline decoration-blue-400 decoration-2 underline-offset-2">Update Bank Account</span>
                    </div>
                </div>

                {/* Impact Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                    {/* High Impact */}
                    <div className="border border-red-200 bg-red-50/50 dark:bg-red-950/10 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                            <AlertTriangle className="h-4 w-4" /> CRITICAL (8)
                        </div>
                        <ul className="text-xs space-y-2 text-red-800/80 dark:text-red-200/80 list-disc list-inside">
                            <li><strong>8 Pending Payments</strong> akan terdampak (Total: Rp 450jt).</li>
                            <li>3 Jadwal Auto-Debit minggu ini perlu approval ulang.</li>
                        </ul>
                    </div>

                    {/* Medium Impact */}
                    <div className="border border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/10 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2 text-yellow-700 font-bold text-sm">
                            <AlertTriangle className="h-4 w-4" /> WARNING (262)
                        </div>
                        <ul className="text-xs space-y-2 text-yellow-800/80 dark:text-yellow-200/80 list-disc list-inside">
                            <li>247 Purchase Orders aktif di sistem history.</li>
                            <li>15 Kontrak aktif yang mereferensikan akun lama.</li>
                        </ul>
                    </div>

                    {/* Low Impact */}
                    <div className="border border-green-200 bg-green-50/50 dark:bg-green-950/10 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2 text-green-700 font-bold text-sm">
                            <CheckCircle2 className="h-4 w-4" /> SAFE
                        </div>
                        <ul className="text-xs space-y-2 text-green-800/80 dark:text-green-200/80 list-disc list-inside">
                            <li>Invoice yang sudah lunas (Paid) tidak akan berubah.</li>
                            <li>Historical ledger entries aman.</li>
                        </ul>
                    </div>

                </div>

                {/* Action Bar */}
                <div className="flex items-center justify-between pt-2 border-t mt-4">
                    <div className="text-xs text-muted-foreground">
                        Required Approvals: <strong>Finance Manager, CFO</strong> • Processing time: ~2h
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm">Cancel Change</Button>
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                            Request Approval
                        </Button>
                    </div>
                </div>

            </CardContent>
        </Card>
    )
}

"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Banknote, FileText, ArrowRight, Wallet, AlertCircle, ShieldCheck, Lock, Building } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

export function PayrollSummaryWidget() {
    const payrollStats = {
        gross: 650000000,
        deductions: 45000000,
        net: 605000000,
        status: "DRAFT",
        period: "JANUARI 2026"
    }

    const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

    return (
        <Card className="col-span-1 md:col-span-2 border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white dark:bg-black">
            <CardHeader className="p-6 border-b border-black bg-zinc-50 dark:bg-zinc-900 flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-xl font-black uppercase tracking-wider flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-indigo-600" />
                        Payroll Periode {payrollStats.period}
                    </CardTitle>
                    <p className="text-xs font-bold text-muted-foreground mt-1 uppercase tracking-wide">Monthly Disbursment Cycle</p>
                </div>
                <Badge variant="outline" className="bg-white text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-mono font-bold">
                    {payrollStats.status} MODE
                </Badge>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                {/* Main Numbers */}
                <div className="grid grid-cols-2 gap-6">
                    <div className="p-4 bg-zinc-50 border border-black/10 rounded-lg">
                        <p className="text-xs font-bold uppercase text-muted-foreground mb-1 tracking-wider">Total Gross</p>
                        <p className="text-2xl font-black text-zinc-800 dark:text-zinc-200">{formatCurrency(payrollStats.gross)}</p>
                    </div>
                    <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
                        <p className="text-xs font-bold uppercase text-red-600/70 mb-1 tracking-wider">Total Deductions</p>
                        <p className="text-2xl font-black text-red-600">-{formatCurrency(payrollStats.deductions)}</p>
                    </div>
                </div>

                {/* Net Total Highlight */}
                <div className="p-4 border border-black bg-indigo-50 dark:bg-indigo-950/20 rounded-lg flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase text-indigo-600 mb-1 tracking-wider">Net Transfer Estimation</p>
                        <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(payrollStats.net)}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <Banknote className="h-5 w-5" />
                    </div>
                </div>

                {/* Progress Status */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="rounded-sm px-1.5 py-0.5 text-[10px] bg-zinc-100 border border-zinc-200 text-zinc-600 font-mono">140/156</Badge>
                            <span className="text-xs font-bold text-muted-foreground uppercase">Payslips Generated</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-red-600">
                            <AlertCircle className="h-3 w-3" />
                            2 ERRORS
                        </div>
                    </div>

                    <div className="relative h-4 w-full bg-zinc-100 border border-black rounded-full overflow-hidden">
                        <div className="absolute top-0 left-0 h-full bg-indigo-500 border-r border-black" style={{ width: '90%' }}>
                            <div className="w-full h-full opacity-20" style={{ backgroundImage: 'linear-gradient(45deg,rgba(0,0,0,.1) 25%,transparent 25%,transparent 50%,rgba(0,0,0,.1) 50%,rgba(0,0,0,.1) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }}></div>
                        </div>
                    </div>
                </div>

                {/* Action Footer */}
                <div className="pt-2 flex gap-3">
                    <PayrollAuthorizationDialog formatCurrency={formatCurrency} netTotal={payrollStats.net} />

                    <Button variant="outline" className="px-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all h-12 bg-white text-black">
                        <FileText className="h-5 w-5" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

function PayrollAuthorizationDialog({ formatCurrency, netTotal }: { formatCurrency: (val: number) => string, netTotal: number }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className="flex-1 bg-indigo-600 text-white border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-bold uppercase tracking-wide h-12">
                    Review & Post Batch <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 gap-0 bg-zinc-50">
                <DialogHeader className="p-6 border-b border-black bg-white">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 bg-indigo-100 border border-black rounded-lg flex items-center justify-center text-indigo-700">
                            <ShieldCheck className="h-6 w-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-black uppercase tracking-tight">Authorization Required</DialogTitle>
                            <DialogDescription className="font-medium text-zinc-500">Secure Payroll Disbursement Approval</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-6 space-y-6">
                    {/* Security Checklist */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-3 border border-black/10 rounded flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span className="text-xs font-bold text-zinc-600">Tax Calculation Verified</span>
                        </div>
                        <div className="bg-white p-3 border border-black/10 rounded flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span className="text-xs font-bold text-zinc-600">Compliance Check Pass</span>
                        </div>
                        <div className="bg-white p-3 border border-black/10 rounded flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span className="text-xs font-bold text-zinc-600">Bank Account Validated</span>
                        </div>
                        <div className="bg-white p-3 border border-black/10 rounded flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span className="text-xs font-bold text-zinc-600">No Ghost Employees</span>
                        </div>
                    </div>

                    {/* Department Allocation Visualization */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-black uppercase text-muted-foreground tracking-wider">Fund Allocation Breakdown</h4>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2"><Building className="h-3 w-3" /> Production Dept</span>
                                <span className="font-mono font-bold">Rp 350.000.000</span>
                            </div>
                            <div className="h-2 w-full bg-zinc-200 rounded-full overflow-hidden border border-black/5">
                                <div className="h-full bg-indigo-500" style={{ width: '58%' }} />
                            </div>

                            <div className="flex items-center justify-between text-sm mt-3">
                                <span className="flex items-center gap-2"><Building className="h-3 w-3" /> Sales & Marketing</span>
                                <span className="font-mono font-bold">Rp 150.000.000</span>
                            </div>
                            <div className="h-2 w-full bg-zinc-200 rounded-full overflow-hidden border border-black/5">
                                <div className="h-full bg-purple-500" style={{ width: '25%' }} />
                            </div>

                            <div className="flex items-center justify-between text-sm mt-3">
                                <span className="flex items-center gap-2"><Building className="h-3 w-3" /> Management & HR</span>
                                <span className="font-mono font-bold">Rp 105.000.000</span>
                            </div>
                            <div className="h-2 w-full bg-zinc-200 rounded-full overflow-hidden border border-black/5">
                                <div className="h-full bg-emerald-500" style={{ width: '17%' }} />
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-3 text-yellow-800 text-xs font-medium">
                        <Lock className="h-4 w-4 flex-shrink-0" />
                        <p>This action is irreversible. Funds will be scheduled for transfer immediately upon authorization. Please ensure your digital signature key is active.</p>
                    </div>

                </div>

                <DialogFooter className="p-6 border-t border-black bg-white flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Total Transfer Amount</p>
                        <p className="text-xl font-black text-indigo-600">{formatCurrency(netTotal)}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsOpen(false)} className="border-black hover:bg-zinc-100">Cancel</Button>
                        <Button onClick={() => setIsOpen(false)} className="bg-black text-white border-black hover:bg-zinc-800 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all">
                            <ShieldCheck className="mr-2 h-4 w-4" /> Authorize Batch
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

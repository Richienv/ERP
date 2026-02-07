"use client"

import { useTheme } from "next-themes"
import { FinancialCommandCenter } from "@/components/accountant/financial-command-center"
import { InvoiceAging } from "@/components/accountant/invoice-aging"
import { BankReconciliation } from "@/components/accountant/bank-reconciliation"

export default function AccountantPage() {
    return (
        <div className="min-h-screen bg-background p-4 md:p-8 space-y-8 pb-24 font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-serif font-medium text-foreground tracking-tight">
                        Pusat Kendali Keuangan
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Diperbaharui: {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                </div>
            </div>

            {/* Section 1: Metrics (Cash, Receivables, Payables, Profitability) */}
            <FinancialCommandCenter />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Section 2: Invoice Aging Assistant */}
                <InvoiceAging />

                {/* Section 3: Smart Bank Reconciliation */}
                <BankReconciliation />
            </div>
        </div>
    )
}

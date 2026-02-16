import { Suspense } from "react"
import {
    getReconciliations,
    getReconciliationDetail,
    getBankAccounts,
    createReconciliation,
    importBankStatementRows,
    autoMatchReconciliation,
    matchReconciliationItem,
    unmatchReconciliationItem,
    closeReconciliation,
} from "@/lib/actions/finance-reconciliation"
import { BankReconciliationView } from "@/components/finance/bank-reconciliation-view"
import { Landmark } from "lucide-react"

export const dynamic = "force-dynamic"

async function ReconciliationContent() {
    const [reconciliations, bankAccounts] = await Promise.all([
        getReconciliations(),
        getBankAccounts(),
    ])

    return (
        <BankReconciliationView
            reconciliations={reconciliations}
            bankAccounts={bankAccounts}
            onCreateReconciliation={createReconciliation}
            onImportRows={importBankStatementRows}
            onAutoMatch={autoMatchReconciliation}
            onMatchItem={matchReconciliationItem}
            onUnmatchItem={unmatchReconciliationItem}
            onClose={closeReconciliation}
            onLoadDetail={getReconciliationDetail}
        />
    )
}

export default function ReconciliationPage() {
    return (
        <div className="p-6 space-y-6">
            <Suspense
                fallback={
                    <div className="flex items-center gap-2 text-zinc-400">
                        <Landmark className="h-5 w-5 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Memuat rekonsiliasi...
                        </span>
                    </div>
                }
            >
                <ReconciliationContent />
            </Suspense>
        </div>
    )
}

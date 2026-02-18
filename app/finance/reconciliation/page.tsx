"use client"

import { useReconciliation } from "@/hooks/use-reconciliation"
import { BankReconciliationView } from "@/components/finance/bank-reconciliation-view"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import {
    createReconciliation,
    importBankStatementRows,
    autoMatchReconciliation,
    matchReconciliationItem,
    unmatchReconciliationItem,
    closeReconciliation,
    getReconciliationDetail,
} from "@/lib/actions/finance-reconciliation"

export default function ReconciliationPage() {
    const { data, isLoading } = useReconciliation()

    if (isLoading || !data) {
        return <TablePageSkeleton accentColor="bg-purple-400" />
    }

    return (
        <div className="p-6 space-y-6">
            <BankReconciliationView
                reconciliations={data.reconciliations}
                bankAccounts={data.bankAccounts}
                onCreateReconciliation={createReconciliation}
                onImportRows={importBankStatementRows}
                onAutoMatch={autoMatchReconciliation}
                onMatchItem={matchReconciliationItem}
                onUnmatchItem={unmatchReconciliationItem}
                onClose={closeReconciliation}
                onLoadDetail={getReconciliationDetail}
            />
        </div>
    )
}

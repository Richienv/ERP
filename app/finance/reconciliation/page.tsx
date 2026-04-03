"use client"

import { useReconciliation } from "@/hooks/use-reconciliation"
import { BankReconciliationView } from "@/components/finance/bank-reconciliation-view"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import {
    createReconciliation,
    importBankStatementRows,
    autoMatchReconciliation,
    matchMultipleItems,
    unmatchReconciliationItem,
    closeReconciliation,
    getReconciliationDetail,
    updateReconciliationMeta,
    excludeReconciliationItem,
    includeReconciliationItem,
    searchUnmatchedJournals,
    createJournalAndMatch,
} from "@/lib/actions/finance-reconciliation"

export default function ReconciliationPage() {
    const { data, isLoading } = useReconciliation()

    if (isLoading || !data) {
        return <TablePageSkeleton accentColor="bg-purple-400" />
    }

    return (
        <div className="mf-page">
            <BankReconciliationView
                reconciliations={data.reconciliations ?? []}
                bankAccounts={data.bankAccounts ?? []}
                bankAccountRecords={data.bankAccountRecords ?? []}
                coaAccounts={data.coaAccounts ?? []}
                onCreateReconciliation={createReconciliation}
                onImportRows={importBankStatementRows}
                onAutoMatch={autoMatchReconciliation}
                onMatchItems={matchMultipleItems}
                onUnmatchItem={unmatchReconciliationItem}
                onClose={closeReconciliation}
                onLoadDetail={getReconciliationDetail}
                onUpdateMeta={updateReconciliationMeta}
                onExcludeItem={excludeReconciliationItem}
                onIncludeItem={includeReconciliationItem}
                onSearchJournals={searchUnmatchedJournals}
                onCreateJournalAndMatch={createJournalAndMatch}
            />
        </div>
    )
}

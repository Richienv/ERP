"use client"

import { useReconciliation } from "@/hooks/use-reconciliation"
import { BankReconciliationView } from "@/components/finance/bank-reconciliation-view"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { InlinePendingBar } from "@/components/ui/inline-pending"
import {
    createReconciliation,
    importBankStatementRows,
    autoMatchReconciliation,
    matchMultipleItems,
    unmatchReconciliationItem,
    closeReconciliation,
    getReconciliationDetail,
    updateReconciliationMeta,
    searchUnmatchedJournals,
    createJournalAndMatch,
    confirmReconciliationItem,
    rejectReconciliationItem,
    ignoreReconciliationItem,
    bulkConfirmCocokItems,
    scoreUnmatchedItems,
} from "@/lib/actions/finance-reconciliation"

export default function ReconciliationPage() {
    const { data, isFetching } = useReconciliation()

    if (!data) {
        return <TablePageSkeleton accentColor="bg-orange-400" />
    }

    return (
        <div className="mf-page relative">
            <InlinePendingBar active={isFetching} />
            <BankReconciliationView
                reconciliations={data.reconciliations ?? []}
                bankAccounts={data.bankAccounts ?? []}
                bankAccountRecords={data.bankAccountRecords ?? []}
                coaAccounts={data.coaAccounts ?? []}
                currencies={data.currencies ?? []}
                onCreateReconciliation={createReconciliation}
                onImportRows={importBankStatementRows}
                onAutoMatch={autoMatchReconciliation}
                onMatchItems={matchMultipleItems}
                onUnmatchItem={unmatchReconciliationItem}
                onClose={closeReconciliation}
                onLoadDetail={getReconciliationDetail}
                onUpdateMeta={updateReconciliationMeta}
                onSearchJournals={searchUnmatchedJournals}
                onCreateJournalAndMatch={createJournalAndMatch}
                onConfirmItem={confirmReconciliationItem}
                onRejectItem={rejectReconciliationItem}
                onIgnoreItem={ignoreReconciliationItem}
                onBulkConfirmCocok={bulkConfirmCocokItems}
                onScoreItems={scoreUnmatchedItems}
            />
        </div>
    )
}

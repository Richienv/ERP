/**
 * Pure month-end close aggregation.
 * Kept next to tests so the gate logic can be unit-tested without Prisma.
 */

export type MonthEndIntegritySignal = {
    failedChecks: number
    draftJournals: number
}

export type MonthEndCountSignal = {
    count: number
    amount: number
}

export type MonthEndFlagSignal = {
    unposted: boolean
    amount: number
}

export type MonthEndSignals = {
    year: number
    month: number
    periodId: string | null
    periodName: string
    isClosed: boolean
    periodMissing: boolean
    integrity: MonthEndIntegritySignal | null
    draftBills: MonthEndCountSignal
    draftInvoices: MonthEndCountSignal
    payroll: MonthEndFlagSignal | null
    depreciation: MonthEndFlagSignal | null
}

export type MonthEndChecklistRow = {
    id: string
    ok: boolean
    blocking: boolean
    label: string
    detail: string
    hint: string
    count?: number
    amount?: number
    href: string
}

export type MonthEndChecklistView = {
    rows: MonthEndChecklistRow[]
    canClose: boolean
    blockerHint: string
    readyCount: number
    totalCount: number
}

export function assembleMonthEndChecklist(signals: MonthEndSignals): MonthEndChecklistView {
    const rows: MonthEndChecklistRow[] = []

    if (signals.integrity) {
        const { failedChecks, draftJournals } = signals.integrity
        const ok = failedChecks === 0 && draftJournals === 0
        const hints: string[] = []
        if (failedChecks > 0) hints.push(`${failedChecks} cek integritas gagal`)
        if (draftJournals > 0) hints.push(`${draftJournals} jurnal masih draft`)
        rows.push({
            id: "integrity",
            ok,
            blocking: true,
            label: "Integritas buku besar",
            detail: ok ? "Neraca saldo seimbang" : hints.join(" · "),
            hint: hints.join(" · "),
            count: failedChecks + draftJournals,
            href: "/finance/journal",
        })
    }

    rows.push({
        id: "draft-bills",
        ok: signals.draftBills.count === 0,
        blocking: true,
        label: "Bill vendor draft",
        detail: signals.draftBills.count === 0
            ? "Tidak ada bill draft"
            : `${signals.draftBills.count} bill masih draft`,
        hint: signals.draftBills.count > 0 ? `${signals.draftBills.count} bill masih draft` : "",
        count: signals.draftBills.count,
        amount: signals.draftBills.amount,
        href: "/finance/bills",
    })

    rows.push({
        id: "draft-invoices",
        ok: signals.draftInvoices.count === 0,
        blocking: true,
        label: "Invoice pelanggan draft",
        detail: signals.draftInvoices.count === 0
            ? "Tidak ada invoice draft"
            : `${signals.draftInvoices.count} invoice masih draft`,
        hint: signals.draftInvoices.count > 0 ? `${signals.draftInvoices.count} invoice masih draft` : "",
        count: signals.draftInvoices.count,
        amount: signals.draftInvoices.amount,
        href: "/finance/invoices",
    })

    if (signals.payroll) {
        rows.push({
            id: "payroll",
            ok: !signals.payroll.unposted,
            blocking: true,
            label: "Payroll periode ini",
            detail: signals.payroll.unposted
                ? `Payroll ${signals.periodName} belum diposting`
                : `Payroll ${signals.periodName} sudah masuk GL`,
            hint: signals.payroll.unposted ? `Payroll ${signals.periodName} belum diposting` : "",
            amount: signals.payroll.amount,
            href: "/hcm/payroll",
        })
    }

    if (signals.depreciation) {
        rows.push({
            id: "depreciation",
            ok: !signals.depreciation.unposted,
            blocking: true,
            label: "Penyusutan aset tetap",
            detail: signals.depreciation.unposted
                ? `Penyusutan ${signals.periodName} belum diposting`
                : signals.depreciation.amount > 0
                    ? `Penyusutan ${signals.periodName} sudah diposting`
                    : "Tidak ada penyusutan jatuh tempo",
            hint: signals.depreciation.unposted
                ? `Penyusutan ${signals.periodName} belum diposting`
                : "",
            amount: signals.depreciation.amount,
            href: "/finance/fixed-assets/depreciation",
        })
    }

    rows.push({
        id: "period-lock",
        ok: !signals.periodMissing,
        blocking: signals.periodMissing,
        label: signals.periodMissing
            ? "Periode fiskal belum ada"
            : signals.isClosed
                ? "Periode sudah dikunci"
                : "Periode terbuka",
        detail: signals.periodMissing
            ? "Generate 12 bulan terlebih dahulu"
            : signals.isClosed
                ? `${signals.periodName} sudah ditutup`
                : `${signals.periodName} siap dikunci`,
        hint: signals.periodMissing ? "Periode fiskal belum digenerate" : "",
        href: "/finance/fiscal-periods",
    })

    const blockers = rows.filter((row) => row.blocking && !row.ok)
    const canClose = blockers.length === 0 && !signals.isClosed && !signals.periodMissing
    const blockerHint = signals.isClosed
        ? "Periode sudah ditutup"
        : blockers.map((row) => row.hint).filter(Boolean).join(" · ")

    return {
        rows,
        canClose,
        blockerHint,
        readyCount: rows.filter((row) => row.ok).length,
        totalCount: rows.length,
    }
}

export function monthEndTitle(periodName: string, isClosed: boolean) {
    return isClosed ? `Buku ${periodName} Sudah Ditutup` : `Siap Tutup Buku — ${periodName}`
}

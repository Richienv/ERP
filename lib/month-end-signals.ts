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

export type MonthEndChecklistInput =
    | { year: number; month: number }
    | { periodId: string }

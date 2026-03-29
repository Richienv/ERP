type RawAgingSummary = {
    current?: number | string | null
    d1_30?: number | string | null
    d31_60?: number | string | null
    d61_90?: number | string | null
    d90_plus?: number | string | null
    totalOutstanding?: number | string | null
    billCount?: number | string | null
    days1to30?: number | string | null
    days31to60?: number | string | null
    days61to90?: number | string | null
    days90plus?: number | string | null
    total?: number | string | null
}

export type APAgingSummary = {
    current: number
    d1_30: number
    d31_60: number
    d61_90: number
    d90_plus: number
    totalOutstanding: number
    billCount: number
}

const toNumber = (value: unknown): number => {
    const num = Number(value)
    return Number.isFinite(num) ? num : 0
}

export function normalizeAPAgingSummary(summary?: RawAgingSummary | null): APAgingSummary {
    const current = toNumber(summary?.current)
    const d1_30 = toNumber(summary?.d1_30 ?? summary?.days1to30)
    const d31_60 = toNumber(summary?.d31_60 ?? summary?.days31to60)
    const d61_90 = toNumber(summary?.d61_90 ?? summary?.days61to90)
    const d90_plus = toNumber(summary?.d90_plus ?? summary?.days90plus)
    const computedTotal = current + d1_30 + d31_60 + d61_90 + d90_plus
    const totalOutstanding = toNumber(summary?.totalOutstanding ?? summary?.total) || computedTotal

    return {
        current,
        d1_30,
        d31_60,
        d61_90,
        d90_plus,
        totalOutstanding,
        billCount: toNumber(summary?.billCount),
    }
}

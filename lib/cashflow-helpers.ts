import type { CashflowItem } from "@/lib/actions/finance-cashflow"

export interface WeekDef {
    label: string
    shortLabel: string
    start: number
    end: number
    isCurrent: boolean
}

export function getWeeks(month: number, year: number): WeekDef[] {
    const lastDay = new Date(year, month, 0).getDate()
    const today = new Date()
    const isCurrentMonth = today.getMonth() + 1 === month && today.getFullYear() === year
    const currentDay = isCurrentMonth ? today.getDate() : -1

    return [
        { label: "Minggu 1 (1-7)", shortLabel: "Mgg 1", start: 1, end: 7, isCurrent: currentDay >= 1 && currentDay <= 7 },
        { label: "Minggu 2 (8-14)", shortLabel: "Mgg 2", start: 8, end: 14, isCurrent: currentDay >= 8 && currentDay <= 14 },
        { label: "Minggu 3 (15-21)", shortLabel: "Mgg 3", start: 15, end: 21, isCurrent: currentDay >= 15 && currentDay <= 21 },
        { label: `Minggu 4 (22-${lastDay})`, shortLabel: "Mgg 4", start: 22, end: lastDay, isCurrent: currentDay >= 22 && currentDay <= lastDay },
    ]
}

export function getItemsForWeek<T extends { date: string }>(items: T[], weekStart: number, weekEnd: number): T[] {
    return items.filter(item => {
        const day = parseInt(item.date.split("-")[2], 10)
        return day >= weekStart && day <= weekEnd
    })
}

export function calcWeekTotals<T extends { direction: "IN" | "OUT"; amount: number }>(items: T[]) {
    const inItems = items.filter(i => i.direction === "IN")
    const outItems = items.filter(i => i.direction === "OUT")
    const totalIn = inItems.reduce((s, i) => s + i.amount, 0)
    const totalOut = outItems.reduce((s, i) => s + i.amount, 0)
    return { totalIn, totalOut, net: totalIn - totalOut, inItems, outItems }
}

export function formatCompact(amount: number): string {
    if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}M`
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}jt`
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}rb`
    return String(Math.round(amount))
}

export function calcCashRunway(startingBalance: number, totalOut: number) {
    const weeklyBurn = totalOut / 4
    const runwayWeeks = weeklyBurn > 0 ? Math.floor(startingBalance / weeklyBurn) : 99
    const label = runwayWeeks >= 12
        ? "Aman > 3 bulan"
        : runwayWeeks >= 4
            ? `Cukup ~${runwayWeeks} minggu`
            : runwayWeeks >= 1
                ? `Kritis! Sisa ${runwayWeeks} minggu`
                : "Darurat! Saldo tidak cukup"
    const color = runwayWeeks >= 8 ? "text-emerald-600" : runwayWeeks >= 4 ? "text-amber-600" : "text-red-600"
    const barPct = Math.min(100, Math.max(5, (runwayWeeks / 12) * 100))
    const barColor = runwayWeeks >= 8 ? "bg-emerald-500" : runwayWeeks >= 4 ? "bg-amber-500" : "bg-red-500"
    return { runwayWeeks, label, color, barPct, barColor }
}

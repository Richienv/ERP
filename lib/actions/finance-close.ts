"use server"

import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import type { MonthEndChecklistInput, MonthEndSignals } from "@/lib/month-end-signals"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

function toNum(value: unknown): number {
    if (value == null) return 0
    if (typeof value === "number") return value
    if (typeof value === "object" && value !== null && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
        return (value as { toNumber: () => number }).toNumber()
    }
    return Number(value) || 0
}

const BULAN_ID = [
    "",
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
]

function periodLabel(year: number, month: number, name?: string | null) {
    if (name) return name
    return `${BULAN_ID[month] ?? month} ${year}`
}

function periodBounds(year: number, month: number, startDate?: Date | null, endDate?: Date | null) {
    const start = startDate ? new Date(startDate) : new Date(year, month - 1, 1)
    const end = endDate ? new Date(endDate) : new Date(year, month, 0)
    return { start, end }
}

/**
 * Read-mostly month-end close signals.
 * Skips runIntegrityChecks() — that helper upserts system accounts.
 * Draft journals + trial-balance aggregates stand in for the buku check.
 */
export async function getMonthEndChecklist(input: MonthEndChecklistInput): Promise<MonthEndSignals> {
    await requireAuth()

    let year: number
    let month: number
    let period: {
        id: string
        year: number
        month: number
        name: string
        startDate: Date
        endDate: Date
        isClosed: boolean
    } | null = null

    try {
        if ("periodId" in input) {
            period = await prisma.fiscalPeriod.findUnique({
                where: { id: input.periodId },
                select: {
                    id: true,
                    year: true,
                    month: true,
                    name: true,
                    startDate: true,
                    endDate: true,
                    isClosed: true,
                },
            })
            if (!period) {
                throw new Error("Periode tidak ditemukan")
            }
            year = period.year
            month = period.month
        } else {
            year = input.year
            month = input.month
            period = await prisma.fiscalPeriod.findUnique({
                where: { year_month: { year, month } },
                select: {
                    id: true,
                    year: true,
                    month: true,
                    name: true,
                    startDate: true,
                    endDate: true,
                    isClosed: true,
                },
            })
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : ""
        if (message === "Periode tidak ditemukan" || message === "Unauthorized") throw error
        const code = (error as { code?: string })?.code
        if (code !== "P2021" && code !== "P2025") {
            throw error
        }
        year = "periodId" in input ? new Date().getFullYear() : input.year
        month = "periodId" in input ? new Date().getMonth() + 1 : input.month
        period = null
    }

    const { start, end } = periodBounds(year, month, period?.startDate, period?.endDate)
    const dateRange = { gte: start, lte: end }
    const periodKey = `${year}-${String(month).padStart(2, "0")}`

    const [draftBills, draftInvoices] = await Promise.all([
        prisma.invoice.aggregate({
            where: { type: "INV_IN", status: "DRAFT", issueDate: dateRange },
            _count: { _all: true },
            _sum: { totalAmount: true },
        }),
        prisma.invoice.aggregate({
            where: { type: "INV_OUT", status: "DRAFT", issueDate: dateRange },
            _count: { _all: true },
            _sum: { totalAmount: true },
        }),
    ])

    let integrity: MonthEndIntegritySignal | null = null
    try {
        const [draftJournals, trial] = await Promise.all([
            prisma.journalEntry.count({
                where: { status: "DRAFT", date: dateRange },
            }),
            prisma.journalLine.aggregate({
                where: { entry: { status: "POSTED" } },
                _sum: { debit: true, credit: true },
            }),
        ])
        const debit = toNum(trial._sum.debit)
        const credit = toNum(trial._sum.credit)
        const unbalanced = Math.abs(debit - credit) > 0.01
        integrity = {
            failedChecks: unbalanced ? 1 : 0,
            draftJournals,
        }
    } catch {
        integrity = null
    }

    let payroll: MonthEndFlagSignal | null = null
    try {
        const payrollTask = await prisma.employeeTask.findFirst({
            where: {
                relatedId: `PAYROLL-${periodKey}`,
                notes: { startsWith: "PAYROLL_RUN::" },
            },
            orderBy: { updatedAt: "desc" },
            select: { notes: true },
        })
        if (payrollTask?.notes) {
            try {
                const json = payrollTask.notes.replace(/^PAYROLL_RUN::/, "")
                const payload = JSON.parse(json) as {
                    status?: string
                    postedJournalReference?: string
                    summary?: { gross?: number; employerBpjs?: number; companyCost?: number }
                }
                const unposted = payload.status !== "POSTED" && !payload.postedJournalReference
                let amount = Number(payload.summary?.companyCost || 0)
                if (!amount) {
                    amount = Number(payload.summary?.gross || 0) + Number(payload.summary?.employerBpjs || 0)
                }
                payroll = { unposted, amount }
            } catch {
                payroll = { unposted: true, amount: 0 }
            }
        }
    } catch {
        payroll = null
    }

    let depreciation: MonthEndFlagSignal | null = null
    try {
        const activeAssets = await prisma.fixedAsset.count({ where: { status: "ACTIVE" } })
        if (activeAssets > 0) {
            const [postedRun, dueSchedules] = await Promise.all([
                prisma.fixedAssetDeprecRun.findFirst({
                    where: {
                        status: "POSTED",
                        periodStart: { lte: end },
                        periodEnd: { gte: start },
                    },
                    select: { totalDepreciation: true },
                }),
                prisma.fixedAssetDeprecSchedule.aggregate({
                    where: {
                        isPosted: false,
                        scheduledDate: dateRange,
                        asset: { status: "ACTIVE" },
                    },
                    _count: { _all: true },
                    _sum: { depreciationAmount: true },
                }),
            ])
            if (postedRun) {
                depreciation = { unposted: false, amount: toNum(postedRun.totalDepreciation) }
            } else if (dueSchedules._count._all > 0) {
                depreciation = { unposted: true, amount: toNum(dueSchedules._sum.depreciationAmount) }
            } else {
                depreciation = { unposted: false, amount: 0 }
            }
        }
    } catch {
        depreciation = null
    }

    return {
        year,
        month,
        periodId: period?.id ?? null,
        periodName: periodLabel(year, month, period?.name),
        isClosed: period?.isClosed ?? false,
        periodMissing: !period,
        integrity,
        draftBills: {
            count: draftBills._count._all,
            amount: toNum(draftBills._sum.totalAmount),
        },
        draftInvoices: {
            count: draftInvoices._count._all,
            amount: toNum(draftInvoices._sum.totalAmount),
        },
        payroll,
        depreciation,
    }
}

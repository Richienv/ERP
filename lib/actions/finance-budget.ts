"use server"

import { withPrismaAuth, prisma as basePrisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export async function getBudgets() {
    const supabaseClient = await createClient()
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    const budgets = await basePrisma.budget.findMany({
        where: { isActive: true },
        orderBy: { year: 'desc' },
        select: { id: true, name: true, year: true, description: true },
    })
    return { success: true, budgets }
}

export async function getCostCenters() {
    const supabaseClient = await createClient()
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    const costCenters = await basePrisma.costCenter.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' },
        select: { id: true, code: true, name: true, type: true },
    })
    return { success: true, costCenters }
}

export async function getBudgetVsActual(
    budgetId: string,
    startDate: string,
    endDate: string,
    costCenterId?: string
) {
    const supabaseClient = await createClient()
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    // Build cost center filter for budget lines
    const budgetLineWhere = costCenterId ? { costCenterId } : {}

    const budget = await basePrisma.budget.findUnique({
            where: { id: budgetId },
            include: {
                lines: {
                    where: budgetLineWhere,
                    include: {
                        account: { select: { id: true, code: true, name: true, type: true } },
                        costCenter: { select: { id: true, code: true, name: true } },
                    },
                    orderBy: [{ account: { code: 'asc' } }, { month: 'asc' }],
                },
            },
        })

        if (!budget) return { success: false, error: 'Budget not found', data: null }

        // Build cost center filter for actuals
        const journalLineWhere: Record<string, unknown> = {
            entry: {
                status: 'POSTED',
                date: { gte: new Date(startDate), lte: new Date(endDate) },
            },
        }
        if (costCenterId) {
            journalLineWhere.costCenterId = costCenterId
        }

        // Get actual journal lines for the period
        const actualLines = await basePrisma.journalLine.findMany({
            where: journalLineWhere,
            include: {
                account: { select: { id: true, code: true, name: true, type: true } },
                entry: { select: { date: true } },
                costCenter: { select: { id: true, code: true, name: true } },
            },
        })

        // Group budget by account
        const accountMap = new Map<string, {
            accountCode: string
            accountName: string
            accountType: string
            budgetAmount: number
            actualAmount: number
        }>()

        for (const line of budget.lines) {
            const key = line.account.id
            const existing = accountMap.get(key) || {
                accountCode: line.account.code,
                accountName: line.account.name,
                accountType: line.account.type,
                budgetAmount: 0,
                actualAmount: 0,
            }
            existing.budgetAmount += Number(line.amount)
            accountMap.set(key, existing)
        }

        // Add actuals
        for (const line of actualLines) {
            const key = line.account.id
            const existing = accountMap.get(key) || {
                accountCode: line.account.code,
                accountName: line.account.name,
                accountType: line.account.type,
                budgetAmount: 0,
                actualAmount: 0,
            }
            // For expense/asset: actual = debit - credit. For revenue/liability: actual = credit - debit
            if (line.account.type === 'EXPENSE' || line.account.type === 'ASSET') {
                existing.actualAmount += Number(line.debit) - Number(line.credit)
            } else {
                existing.actualAmount += Number(line.credit) - Number(line.debit)
            }
            accountMap.set(key, existing)
        }

        const items = Array.from(accountMap.values())
            .map(item => ({
                ...item,
                variance: item.budgetAmount - item.actualAmount,
                variancePct: item.budgetAmount > 0 ? ((item.budgetAmount - item.actualAmount) / item.budgetAmount) * 100 : 0,
            }))
            .sort((a, b) => a.accountCode.localeCompare(b.accountCode))

        const totalBudget = items.reduce((s, i) => s + i.budgetAmount, 0)
        const totalActual = items.reduce((s, i) => s + i.actualAmount, 0)

        return {
            success: true,
            data: {
                budgetName: budget.name,
                budgetYear: budget.year,
                period: { startDate, endDate },
                costCenterId: costCenterId || null,
                items,
                summary: {
                    totalBudget,
                    totalActual,
                    totalVariance: totalBudget - totalActual,
                    totalVariancePct: totalBudget > 0 ? ((totalBudget - totalActual) / totalBudget) * 100 : 0,
                },
            },
        }
}

export async function createBudget(data: { name: string; year: number; description?: string }) {
    return await withPrismaAuth(async (prisma) => {
        const budget = await prisma.budget.create({
            data: {
                name: data.name,
                year: data.year,
                description: data.description,
            },
        })
        return { success: true, budgetId: budget.id }
    })
}

export async function saveBudgetLines(
    budgetId: string,
    lines: { accountId: string; month: number; amount: number; costCenterId?: string }[]
) {
    return await withPrismaAuth(async (prisma) => {
        // Upsert each line
        for (const line of lines) {
            await prisma.budgetLine.upsert({
                where: {
                    budgetId_accountId_month: {
                        budgetId,
                        accountId: line.accountId,
                        month: line.month,
                    },
                },
                create: {
                    budgetId,
                    accountId: line.accountId,
                    month: line.month,
                    amount: line.amount,
                    ...(line.costCenterId ? { costCenterId: line.costCenterId } : {}),
                },
                update: {
                    amount: line.amount,
                    ...(line.costCenterId ? { costCenterId: line.costCenterId } : {}),
                },
            })
        }
        return { success: true }
    })
}

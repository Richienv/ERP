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

/**
 * Cost centers are NOT implemented.
 *
 * There is no `CostCenter` model in prisma/schema.prisma and no `costCenterId`
 * column on BudgetLine or JournalLine. Every function below therefore refuses
 * cost-center input loudly instead of silently ignoring it or crashing deep
 * inside Prisma with an unknown-argument error.
 *
 * TODO(schema): to enable this feature, add `model CostCenter` plus
 * `costCenterId` on BudgetLine and JournalLine, run a migration, then restore
 * the includes/filters marked with COST_CENTER below.
 */
const COST_CENTER_NOT_IMPLEMENTED =
    'Fitur Cost Center belum tersedia — model CostCenter belum ada di database schema.'

export async function getCostCenters(): Promise<never> {
    const supabaseClient = await createClient()
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    // COST_CENTER: no backing model — fail explicitly rather than return fake data.
    throw new Error(COST_CENTER_NOT_IMPLEMENTED)
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

    // COST_CENTER: BudgetLine/JournalLine have no costCenterId column, so a
    // cost-center-scoped report cannot be produced. Refuse rather than silently
    // returning company-wide numbers under a cost-center label.
    if (costCenterId) throw new Error(COST_CENTER_NOT_IMPLEMENTED)

    const budget = await basePrisma.budget.findUnique({
            where: { id: budgetId },
            include: {
                lines: {
                    include: {
                        account: { select: { id: true, code: true, name: true, type: true } },
                    },
                    orderBy: [{ account: { code: 'asc' } }, { month: 'asc' }],
                },
            },
        })

        if (!budget) return { success: false, error: 'Budget not found', data: null }

        // Get actual journal lines for the period
        const actualLines = await basePrisma.journalLine.findMany({
            where: {
                entry: {
                    status: 'POSTED',
                    date: { gte: new Date(startDate), lte: new Date(endDate) },
                },
            },
            include: {
                account: { select: { id: true, code: true, name: true, type: true } },
                entry: { select: { date: true } },
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
    // COST_CENTER: BudgetLine has no costCenterId column — writing it would blow up
    // inside Prisma with an unknown-argument error, so reject it up front.
    if (lines.some((l) => l.costCenterId)) throw new Error(COST_CENTER_NOT_IMPLEMENTED)

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
                },
                update: {
                    amount: line.amount,
                },
            })
        }
        return { success: true }
    })
}

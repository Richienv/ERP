"use server"

import { prisma as basePrisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { postJournalEntry } from "./finance-gl"

const PETTY_CASH_ACCOUNT = "1050"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// READ — uses prisma singleton (no transaction, no pool pressure)
export async function getPettyCashTransactions() {
    try {
        await requireAuth()

        // Ensure GL account exists
        await basePrisma.gLAccount.upsert({
            where: { code: PETTY_CASH_ACCOUNT },
            create: { code: PETTY_CASH_ACCOUNT, name: "Kas Kecil (Petty Cash)", type: "ASSET", balance: 0 },
            update: {},
        })

        const transactions = await basePrisma.pettyCashTransaction.findMany({
            orderBy: { date: "desc" },
            include: {
                bankAccount: { select: { code: true, name: true } },
                expenseAccount: { select: { code: true, name: true } },
            },
            take: 200,
        })

        const latestTx = transactions[0]
        const currentBalance = latestTx ? Number(latestTx.balanceAfter) : 0

        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const thisMonth = transactions.filter(t => new Date(t.date) >= monthStart)
        const totalTopup = thisMonth.filter(t => t.type === "TOPUP").reduce((s, t) => s + Number(t.amount), 0)
        const totalDisbursement = thisMonth.filter(t => t.type === "DISBURSEMENT").reduce((s, t) => s + Number(t.amount), 0)

        return {
            success: true as const,
            transactions: transactions.map(t => ({
                id: t.id,
                date: t.date,
                type: t.type,
                amount: Number(t.amount),
                recipientName: t.recipientName,
                description: t.description,
                bankAccountName: t.bankAccount ? `${t.bankAccount.code} — ${t.bankAccount.name}` : null,
                expenseAccountName: t.expenseAccount ? `${t.expenseAccount.code} — ${t.expenseAccount.name}` : null,
                balanceAfter: Number(t.balanceAfter),
            })),
            currentBalance,
            totalTopup,
            totalDisbursement,
        }
    } catch (error: any) {
        console.error("getPettyCashTransactions error:", error)
        return { success: false as const, error: error?.message || "Gagal memuat data peti kas", transactions: [], currentBalance: 0, totalTopup: 0, totalDisbursement: 0 }
    }
}

// WRITE — uses basePrisma + requireAuth (avoids pool exhaustion from withPrismaAuth)
export async function topUpPettyCash(data: {
    amount: number
    bankAccountCode: string
    description: string
}) {
    await requireAuth()

    const bankAccount = await basePrisma.gLAccount.findUnique({ where: { code: data.bankAccountCode } })
    if (!bankAccount) throw new Error("Akun bank tidak ditemukan")

    const latest = await basePrisma.pettyCashTransaction.findFirst({ orderBy: { date: "desc" } })
    const currentBalance = latest ? Number(latest.balanceAfter) : 0
    const newBalance = currentBalance + data.amount

    const tx = await basePrisma.pettyCashTransaction.create({
        data: {
            type: "TOPUP",
            amount: data.amount,
            description: data.description || "Top up dari bank",
            bankAccountId: bankAccount.id,
            balanceAfter: newBalance,
        },
    })

    // Post GL: DR Petty Cash, CR Bank
    try {
        await postJournalEntry({
            description: `Top Up Peti Kas — ${data.description}`,
            date: new Date(),
            reference: `PETTY-${tx.id.slice(0, 8).toUpperCase()}`,
            lines: [
                { accountCode: PETTY_CASH_ACCOUNT, debit: data.amount, credit: 0, description: "Top up peti kas" },
                { accountCode: data.bankAccountCode, debit: 0, credit: data.amount, description: "Transfer ke peti kas" },
            ],
        })
    } catch (glErr) {
        console.warn("GL entry failed for petty cash top-up:", glErr)
    }

    return { success: true as const }
}

// WRITE — uses basePrisma + requireAuth (avoids pool exhaustion from withPrismaAuth)
export async function disbursePettyCash(data: {
    amount: number
    recipientName: string
    description: string
    expenseAccountCode: string
}) {
    await requireAuth()

    const expenseAccount = await basePrisma.gLAccount.findUnique({ where: { code: data.expenseAccountCode } })
    if (!expenseAccount) throw new Error("Akun beban tidak ditemukan")

    const latest = await basePrisma.pettyCashTransaction.findFirst({ orderBy: { date: "desc" } })
    const currentBalance = latest ? Number(latest.balanceAfter) : 0

    if (currentBalance < data.amount) {
        return { success: false as const, error: `Saldo peti kas tidak cukup (saldo: Rp ${currentBalance.toLocaleString("id-ID")})` }
    }

    const newBalance = currentBalance - data.amount

    const tx = await basePrisma.pettyCashTransaction.create({
        data: {
            type: "DISBURSEMENT",
            amount: data.amount,
            recipientName: data.recipientName,
            description: data.description,
            expenseAccountId: expenseAccount.id,
            balanceAfter: newBalance,
        },
    })

    // Post GL: DR Expense, CR Petty Cash
    try {
        await postJournalEntry({
            description: `Pengeluaran Peti Kas — ${data.recipientName}: ${data.description}`,
            date: new Date(),
            reference: `PETTY-${tx.id.slice(0, 8).toUpperCase()}`,
            lines: [
                { accountCode: data.expenseAccountCode, debit: data.amount, credit: 0, description: `${data.recipientName}: ${data.description}` },
                { accountCode: PETTY_CASH_ACCOUNT, debit: 0, credit: data.amount, description: "Pengeluaran peti kas" },
            ],
        })
    } catch (glErr) {
        console.warn("GL entry failed for petty cash disbursement:", glErr)
    }

    return { success: true as const }
}

// READ — uses prisma singleton
export async function getExpenseAccounts() {
    try {
        await requireAuth()

        // Ensure common expense accounts exist
        const defaults = [
            { code: "5100", name: "Beban Transportasi", type: "EXPENSE" as const },
            { code: "5200", name: "Beban Makan & Minum", type: "EXPENSE" as const },
            { code: "5300", name: "Beban ATK & Supplies", type: "EXPENSE" as const },
            { code: "5400", name: "Beban Operasional Lainnya", type: "EXPENSE" as const },
            { code: "5500", name: "Beban Perbaikan & Maintenance", type: "EXPENSE" as const },
        ]
        for (const d of defaults) {
            await basePrisma.gLAccount.upsert({
                where: { code: d.code },
                create: { ...d, balance: 0 },
                update: {},
            })
        }

        return await basePrisma.gLAccount.findMany({
            where: { type: "EXPENSE" },
            orderBy: { code: "asc" },
            select: { code: true, name: true },
        })
    } catch {
        return []
    }
}

// CREATE — inline expense account creation from petty cash dialog
export async function createExpenseAccount(name: string) {
    try {
        await requireAuth()

        // Check if an expense account with this exact name already exists
        const existing = await basePrisma.gLAccount.findFirst({
            where: { type: "EXPENSE", name: { equals: name, mode: "insensitive" } },
            select: { code: true, name: true },
        })
        if (existing) {
            return { success: true, code: existing.code, name: existing.name }
        }

        // Auto-generate next expense code (5xxx series) with collision check
        const allExpenseCodes = await basePrisma.gLAccount.findMany({
            where: { type: "EXPENSE", code: { startsWith: "5" } },
            select: { code: true },
            orderBy: { code: "desc" },
        })
        const existingCodes = new Set(allExpenseCodes.map(a => a.code))

        let nextNum = allExpenseCodes.length > 0
            ? Number(allExpenseCodes[0].code) + 100
            : 5100

        // Skip collisions
        while (existingCodes.has(String(nextNum).padStart(4, "0"))) {
            nextNum += 10
        }
        const nextCode = String(nextNum).padStart(4, "0")

        const account = await basePrisma.gLAccount.create({
            data: { code: nextCode, name, type: "EXPENSE", balance: 0 },
        })

        return { success: true, code: account.code, name: account.name }
    } catch (e: any) {
        console.error("createExpenseAccount error:", e)
        return { success: false, error: e.message }
    }
}

// READ — uses prisma singleton
export async function getBankAccounts() {
    try {
        await requireAuth()

        // Ensure common cash/bank accounts exist
        const defaults = [
            { code: "1000", name: "Kas Besar (Cash on Hand)", type: "ASSET" as const },
            { code: "1010", name: "Bank BCA", type: "ASSET" as const },
            { code: "1020", name: "Bank Mandiri", type: "ASSET" as const },
        ]
        for (const d of defaults) {
            await basePrisma.gLAccount.upsert({
                where: { code: d.code },
                create: { ...d, balance: 0 },
                update: {},
            })
        }

        // Return all ASSET accounts that are cash/bank (exclude petty cash itself and non-cash assets)
        return await basePrisma.gLAccount.findMany({
            where: {
                type: "ASSET",
                code: { not: PETTY_CASH_ACCOUNT },
                OR: [
                    { code: { startsWith: "1" } },
                    { name: { contains: "Bank", mode: "insensitive" } },
                    { name: { contains: "Kas", mode: "insensitive" } },
                ],
            },
            orderBy: { code: "asc" },
            select: { code: true, name: true },
        })
    } catch {
        return []
    }
}

// CREATE — inline bank account creation from top-up dialog
export async function createBankAccount(name: string) {
    try {
        await requireAuth()

        // Auto-generate next bank code (10xx series, skip 1050 petty cash)
        const lastBank = await basePrisma.gLAccount.findFirst({
            where: {
                type: "ASSET",
                code: { startsWith: "10", not: PETTY_CASH_ACCOUNT },
            },
            orderBy: { code: "desc" },
            select: { code: true },
        })

        let nextCode = "1010"
        if (lastBank) {
            let candidate = Number(lastBank.code) + 10
            if (String(candidate) === PETTY_CASH_ACCOUNT) candidate += 10
            nextCode = String(candidate).padStart(4, "0")
        }

        const account = await basePrisma.gLAccount.create({
            data: { code: nextCode, name, type: "ASSET", balance: 0 },
        })

        return { success: true, code: account.code, name: account.name }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

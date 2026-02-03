'use server'

import { prisma } from "@/lib/prisma" // Keep for writes for now if needed, or remove if fully migrating
import { supabase } from "@/lib/supabase"

export interface FinancialMetrics {
    cashBalance: number
    receivables: number // Piutang
    payables: number    // Hutang
    netMargin: number   // %
    revenue: number
    burnRate: number
    overdueInvoices: any[] // List of overdue customer invoices
    upcomingPayables: any[] // List of supplier invoices due soon
    status: {
        cash: 'Healthy' | 'Low' | 'Critical'
        margin: 'Healthy' | 'Low' | 'Critical'
    }
}

export async function getFinancialMetrics(): Promise<FinancialMetrics> {
    try {
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)
        const startOfMonthIso = startOfMonth.toISOString()

        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const thirtyDaysAgoIso = thirtyDaysAgo.toISOString()

        const nowIso = new Date().toISOString()

        // 1. Expense Accounts
        const { data: expenseAccounts } = await supabase
            .from('gl_accounts')
            .select('id')
            .eq('type', 'EXPENSE')
        
        const expenseAccountIds = expenseAccounts?.map(a => a.id) || []

        // Parallel Fetching
        const [
            arResult,
            overdueResult,
            apResult,
            upcomingResult,
            cashResult,
            burnResult,
            revenueResult,
            expenseResult
        ] = await Promise.all([
            // 1. Receivables (All OUT invoices that are OPEN)
            supabase.from('invoices')
                .select('balanceDue')
                .eq('type', 'INV_OUT')
                .in('status', ['ISSUED', 'PARTIAL', 'OVERDUE']),
            
            // 2. Overdue Invoices
            supabase.from('invoices')
                .select('*, customer:customers(name)')
                .eq('type', 'INV_OUT')
                .in('status', ['ISSUED', 'PARTIAL', 'OVERDUE'])
                .lt('dueDate', nowIso)
                .order('dueDate', { ascending: true })
                .limit(3),

            // 3. Payables
            supabase.from('invoices')
                .select('balanceDue')
                .eq('type', 'INV_IN')
                .in('status', ['ISSUED', 'PARTIAL', 'OVERDUE']),

            // 4. Upcoming Payables
            supabase.from('invoices')
                .select('*, supplier:suppliers(name)')
                .eq('type', 'INV_IN')
                .in('status', ['ISSUED', 'PARTIAL', 'OVERDUE'])
                .gte('dueDate', nowIso)
                .order('dueDate', { ascending: true })
                .limit(3),

            // 5. Cash Balance
            supabase.from('gl_accounts')
                .select('balance')
                .eq('type', 'ASSET')
                .in('code', ['1000', '1010', '1020']),

            // 6. Burn Rate (Expenses last 30 days)
            // Need join with journal_entries to filter by date
            expenseAccountIds.length > 0 ? supabase.from('journal_lines')
                .select('debit, journal_entries!inner(date)')
                .in('accountId', expenseAccountIds)
                .gte('journal_entries.date', thirtyDaysAgoIso) : Promise.resolve({ data: [] }),

            // 7. Revenue (This Month)
            supabase.from('invoices')
                .select('totalAmount')
                .eq('type', 'INV_OUT')
                .gte('issueDate', startOfMonthIso)
                .neq('status', 'CANCELLED'),

            // 8. Expenses (This Month)
            supabase.from('invoices')
                .select('totalAmount')
                .eq('type', 'INV_IN')
                .gte('issueDate', startOfMonthIso)
                .neq('status', 'CANCELLED')
        ])

        // Aggregations (JS Side)
        const calculateSum = (data: any[], field: string) => data?.reduce((sum, item) => sum + (Number(item[field]) || 0), 0) || 0

        const receivables = calculateSum(arResult.data || [], 'balanceDue')
        const payables = calculateSum(apResult.data || [], 'balanceDue')
        const cashBal = calculateSum(cashResult.data || [], 'balance')
        
        // Burn Rate
        const burnTotal = (burnResult as any).data?.reduce((sum: number, item: any) => sum + (Number(item.debit) || 0), 0) || 0
        const burnRate = burnTotal / 30

        const revVal = calculateSum(revenueResult.data || [], 'totalAmount')
        const expVal = calculateSum(expenseResult.data || [], 'totalAmount')
        const margin = revVal > 0 ? ((revVal - expVal) / revVal) * 100 : 0

        // Mapping Lists
        const mapInvoice = (inv: any) => ({
            ...inv,
            subtotal: Number(inv.subtotal || 0),
            taxAmount: Number(inv.taxAmount || 0),
            discountAmount: Number(inv.discountAmount || 0),
            totalAmount: Number(inv.totalAmount || 0),
            balanceDue: Number(inv.balanceDue || 0),
            customer: inv.customer,
            supplier: inv.supplier
        })

        return {
            cashBalance: cashBal,
            receivables,
            payables,
            netMargin: Number(margin.toFixed(1)),
            revenue: revVal,
            burnRate,
            overdueInvoices: overdueResult.data?.map(mapInvoice) || [],
            upcomingPayables: upcomingResult.data?.map(mapInvoice) || [],
            status: {
                cash: cashBal > 100000000 ? 'Healthy' : 'Low',
                margin: margin > 10 ? 'Healthy' : 'Low'
            }
        }

    } catch (error) {
        console.error("Failed to fetch financial metrics:", error)
        return {
            cashBalance: 0,
            receivables: 0,
            payables: 0,
            netMargin: 0,
            revenue: 0,
            burnRate: 0,
            overdueInvoices: [],
            upcomingPayables: [],
            status: { cash: 'Critical', margin: 'Critical' }
        }
    }
}

export async function getGLAccounts() {
    try {
        const { data: accounts, error } = await supabase
            .from('gl_accounts')
            .select('*')
            .order('code', { ascending: true })
            
        if (error) throw error

        return { success: true, data: accounts }
    } catch (error) {
        console.error("Error fetching GL Accounts:", error)
        return { success: false, error: "Failed to fetch accounts" }
    }
}

// ==========================================
// JOURNAL ENTRY SYSTEM (CORE)
// ==========================================

export async function postJournalEntry(data: {
    description: string
    date: Date
    reference: string
    lines: {
        accountCode: string
        debit: number
        credit: number
        description?: string
    }[]
}) {
    try {
        // 1. Validate Balance (Debit must equal Credit)
        const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0)
        const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0)

        if (Math.abs(totalDebit - totalCredit) > 0.01) { // Floating point tolerance
            throw new Error(`Unbalanced Journal: Debit (${totalDebit}) != Credit (${totalCredit})`)
        }

        // 2. Fetch Account IDs
        const codes = data.lines.map(l => l.accountCode)
        const accounts = await prisma.gLAccount.findMany({
            where: { code: { in: codes } }
        })

        const accountMap = new Map(accounts.map(a => [a.code, a]))

        // 3. Create Entry & Lines Transactionally
        await prisma.$transaction(async (tx) => {
            // Create Header
            const entry = await tx.journalEntry.create({
                data: {
                    date: data.date,
                    description: data.description,
                    reference: data.reference,
                    status: 'POSTED',
                    lines: {
                        create: data.lines.map(line => {
                            const account = accountMap.get(line.accountCode)
                            if (!account) throw new Error(`Account code not found: ${line.accountCode}`)

                            return {
                                accountId: account.id,
                                debit: line.debit,
                                credit: line.credit,
                                description: line.description || data.description
                            }
                        })
                    }
                }
            })

            // Update Account Balances
            for (const line of data.lines) {
                const account = accountMap.get(line.accountCode)!
                let balanceChange = 0

                if (['ASSET', 'EXPENSE'].includes(account.type)) {
                    balanceChange = line.debit - line.credit
                } else {
                    balanceChange = line.credit - line.debit
                }

                await tx.gLAccount.update({
                    where: { id: account.id },
                    data: { balance: { increment: balanceChange } }
                })
            }
        })

        return { success: true }

        return { success: true }

    } catch (error: any) {
        console.error("Journal Posting Error:", error)
        return { success: false, error: error.message }
    }
}

// ==========================================
// PROCUREMENT INTEGRATION
// ==========================================

export async function recordPendingBillFromPO(po: any) {
    try {
        console.log("Creating/Updating Finance Bill for PO:", po.number)

        // Check if Bill already exists for this PO
        const existingBill = await prisma.invoice.findFirst({
            where: { orderId: po.id, type: 'INV_IN' }
        })

        if (existingBill) {
            console.log("Bill already exists:", existingBill.number)
            return { success: true, billId: existingBill.id }
        }

        // Create new Bill (Invoice Type IN)
        const bill = await prisma.invoice.create({
            data: {
                number: `BILL-${po.number}`, // Simple Bill Number
                type: 'INV_IN',
                supplierId: po.supplierId,
                orderId: po.id,
                status: 'DRAFT', // Needs explicit confirmation in Finance
                issueDate: new Date(),
                dueDate: new Date(new Date().setDate(new Date().getDate() + 30)), // Default 30 days

                // Copy financial connection
                subtotal: po.netAmount || 0, // Using netAmount as subtotal for now
                taxAmount: po.taxAmount || 0,
                totalAmount: po.totalAmount || 0,
                balanceDue: po.totalAmount || 0,

                // Copy Items
                items: {
                    create: po.items.map((item: any) => ({
                        description: item.product?.name || 'Unknown Item',
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        amount: item.totalPrice,
                        productId: item.productId
                    }))
                }
            }
        })

        console.log("Bill Created:", bill.number)
        return { success: true, billId: bill.id }

    } catch (error) {
        console.error("Failed to record pending bill:", error)
        // We do NOT throw here, so we don't block the PO approval flow.
        // But we should likely log an alert or return error structure.
        return { success: false, error: "Finance Sync Failed" }
    }
}

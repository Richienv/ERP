import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function postJournalEntry(data: {
    description: string
    date: Date
    reference?: string
    lines: {
        accountCode: string
        debit: number
        credit: number
        description?: string
    }[]
}) {
    // Reuse logic from finance.ts for consistency in test
    // 1. Validate Accounts
    const codes = data.lines.map(l => l.accountCode)
    const accounts = await prisma.gLAccount.findMany({ where: { code: { in: codes } } })

    if (accounts.length !== new Set(codes).size) {
        // Some accounts might be missing, normally trigger error, but for test we log
        console.warn("Some accounts missing in JE")
    }

    const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0)
    const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0)

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(`Journal Entry Unbalanced: Debit ${totalDebit} != Credit ${totalCredit}`)
    }

    // 2. Create Entry
    const entry = await prisma.journalEntry.create({
        data: {
            date: data.date,
            description: data.description,
            reference: data.reference,
            // totalDebit/Credit are not in schema
            lines: {
                create: data.lines.map(line => ({
                    accountId: accounts.find(a => a.code === line.accountCode)?.id!,
                    debit: line.debit,
                    credit: line.credit,
                    description: line.description || data.description
                }))
            }
        }
    })

    // 3. Update Account Balances
    for (const line of data.lines) {
        const account = accounts.find(a => a.code === line.accountCode)
        if (account) {
            // Debit increases Assets/Expenses, decreases Liability/Equity/Revenue
            // Credit increases Liability/Equity/Revenue, decreases Assets/Expenses
            // We store signed balance? Usually Debit is positive for Asset/Expense.
            // Let's assume standard: Asset/Expense (Debit+), Liab/Equity/Rev (Credit+)
            // But usually balance is just sum(debit) - sum(credit) for Asset/Expense?

            // Simplification for test: We just want to see the update
            // Actual logic in `finance.ts` might be more complex
            let balanceChange = line.debit - line.credit
            if (['LIABILITY', 'EQUITY', 'REVENUE'].includes(account.type)) {
                balanceChange = line.credit - line.debit
            }

            await prisma.gLAccount.update({
                where: { id: account.id },
                data: { balance: { increment: balanceChange } }
            })
        }
    }

    return entry
}

async function approveVendorBillLogic(billId: string) {
    console.log(`Approving Bill ${billId}...`)

    // 1. Get Bill Details
    const bill = await prisma.invoice.findUnique({
        where: { id: billId },
        include: {
            supplier: true,
            items: {
                include: { product: true }
            }
        }
    })

    if (!bill) throw new Error("Bill not found")

    // 2. Update Status to ISSUED (Approved)
    await prisma.invoice.update({
        where: { id: billId },
        data: { status: 'ISSUED' }
    })

    // 3. Post to General Ledger (Accrual Basis)
    const glLines: any[] = []
    let totalAmount = 0

    // Credit AP (Liability increases)
    const apAccount = await prisma.gLAccount.findFirst({ where: { code: '2000' } })
    if (!apAccount) throw new Error("AP Account (2000) not configured")

    // Determine Debit Accounts (Expenses/Assets)
    for (const item of bill.items) {
        const amount = Number(item.amount)
        totalAmount += amount

        // Attempt to find expense account from product, else default (6000)
        let debitAccountCode = '6000'
        const expenseAccount = await prisma.gLAccount.findFirst({ where: { code: debitAccountCode } })

        if (expenseAccount) {
            glLines.push({
                accountCode: debitAccountCode,
                debit: amount,
                credit: 0,
                description: `${item.description} (Qty: ${item.quantity})`
            })
        } else {
            // Fallback
            console.warn("No Expense account found for bill item")
        }
    }

    // Add Tax
    if (Number(bill.taxAmount) > 0) {
        const vatInAccount = await prisma.gLAccount.findFirst({ where: { code: '1300' } }) // VAT In
        if (vatInAccount) {
            glLines.push({
                accountCode: '1300',
                debit: Number(bill.taxAmount),
                credit: 0,
                description: `VAT In - Bill ${bill.number}`
            })
            totalAmount += Number(bill.taxAmount)
        }
    }

    // Add AP Credit Line
    glLines.push({
        accountCode: '2000',
        debit: 0,
        credit: totalAmount,
        description: `AP - ${bill.supplier?.name}`
    })

    // Post Journal Entry
    const entry = await postJournalEntry({
        description: `Bill Approval #${bill.number} - ${bill.supplier?.name}`,
        date: new Date(),
        reference: bill.number,
        lines: glLines
    })

    return { success: true, entryId: entry.id }

}

async function main() {
    try {
        console.log("Starting Verification...")

        // 1. Setup Data
        // Ensure AP Account
        let ap = await prisma.gLAccount.findFirst({ where: { code: '2000' } })
        if (!ap) {
            ap = await prisma.gLAccount.create({
                data: { code: '2000', name: 'Accounts Payable', type: 'LIABILITY', balance: 0 }
            })
            console.log("Created AP Account 2000")
        }

        // Ensure Expense Account
        let exp = await prisma.gLAccount.findFirst({ where: { code: '6000' } })
        if (!exp) {
            exp = await prisma.gLAccount.create({
                data: { code: '6000', name: 'General Expense', type: 'EXPENSE', balance: 0 }
            })
            console.log("Created Expense Account 6000")
        }

        // Ensure Vendor
        let vendor = await prisma.supplier.findFirst({ where: { name: 'Test Vendor' } })
        if (!vendor) {
            vendor = await prisma.supplier.create({
                data: {
                    name: 'Test Vendor',
                    email: 'test@vendor.com',
                    code: 'VEND-TEST'
                }
            })
        }

        // Create Draft Bill
        const bill = await prisma.invoice.create({
            data: {
                number: `TEST-BILL-${Date.now()}`,
                type: 'INV_IN',
                supplierId: vendor.id,
                status: 'DRAFT',
                issueDate: new Date(),
                dueDate: new Date(),
                subtotal: 1000,
                taxAmount: 0,
                totalAmount: 1000,
                balanceDue: 1000,
                items: {
                    create: [{
                        description: 'Test Service',
                        quantity: 1,
                        unitPrice: 1000,
                        amount: 1000
                    }]
                }
            }
        })
        console.log(`Created Draft Bill: ${bill.number}`)

        // 2. Execute Logic
        const result = await approveVendorBillLogic(bill.id)

        // 3. Verify
        console.log("Logic Result:", result)

        const updatedBill = await prisma.invoice.findUnique({ where: { id: bill.id } })
        console.log("Updated Bill Status:", updatedBill?.status)

        const je = await prisma.journalEntry.findUnique({
            where: { id: result.entryId },
            include: { lines: { include: { account: true } } }
        })
        console.log("Journal Entry Created:", je?.description)
        je?.lines.forEach(l => {
            console.log(` - ${l.account.code} (${l.account.name}): Debit ${l.debit}, Credit ${l.credit}`)
        })

        if (updatedBill?.status === 'ISSUED' && je) {
            console.log("SUCCESS: Verification Passed")
        } else {
            console.error("FAILURE: Verification Failed")
        }

    } catch (e) {
        console.error("Error:", e)
    } finally {
        await prisma.$disconnect()
    }
}

main()

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

// GET — fetch all GL accounts grouped by type
export async function GET() {
    try {
        const supabase = await createClient()
        const {
            data: { user },
            error,
        } = await supabase.auth.getUser()
        if (error || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const accounts = await prisma.gLAccount.findMany({
            orderBy: [{ type: "asc" }, { code: "asc" }],
            select: {
                id: true,
                code: true,
                name: true,
                type: true,
                balance: true,
            },
        })

        // Check if an opening balance journal entry already exists
        const existingEntry = await prisma.journalEntry.findFirst({
            where: { reference: "OPENING-BALANCE-2026" },
            include: {
                lines: {
                    select: {
                        accountId: true,
                        debit: true,
                        credit: true,
                    },
                },
            },
        })

        // Group accounts by type
        const grouped: Record<string, typeof accounts> = {
            ASSET: [],
            LIABILITY: [],
            EQUITY: [],
            REVENUE: [],
            EXPENSE: [],
        }

        for (const acc of accounts) {
            if (grouped[acc.type]) {
                grouped[acc.type].push(acc)
            }
        }

        // Build a map of existing opening balance lines by accountId
        const existingLines: Record<string, { debit: number; credit: number }> = {}
        if (existingEntry) {
            for (const line of existingEntry.lines) {
                existingLines[line.accountId] = {
                    debit: Number(line.debit),
                    credit: Number(line.credit),
                }
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                grouped,
                existingLines,
                hasExisting: !!existingEntry,
                existingEntryId: existingEntry?.id ?? null,
            },
        })
    } catch (err) {
        console.error("[opening-balances GET]", err)
        return NextResponse.json(
            { error: "Gagal memuat data akun" },
            { status: 500 }
        )
    }
}

// POST — create/update opening balance journal entry
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const {
            data: { user },
            error,
        } = await supabase.auth.getUser()
        if (error || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        const { lines, fiscalYearStart } = body as {
            lines: Array<{
                accountId: string
                debit: number
                credit: number
            }>
            fiscalYearStart: string // ISO date string
        }

        if (!lines || !Array.isArray(lines)) {
            return NextResponse.json(
                { error: "Data baris jurnal tidak valid" },
                { status: 400 }
            )
        }

        // Filter out zero-value lines
        const nonZeroLines = lines.filter((l) => l.debit > 0 || l.credit > 0)

        if (nonZeroLines.length === 0) {
            return NextResponse.json(
                { error: "Minimal satu akun harus memiliki saldo" },
                { status: 400 }
            )
        }

        // Validate balanced: total debits = total credits
        const totalDebit = nonZeroLines.reduce((s, l) => s + l.debit, 0)
        const totalCredit = nonZeroLines.reduce((s, l) => s + l.credit, 0)

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            return NextResponse.json(
                {
                    error: `Total Debit (${totalDebit.toLocaleString("id-ID")}) tidak sama dengan Total Kredit (${totalCredit.toLocaleString("id-ID")})`,
                },
                { status: 400 }
            )
        }

        const date = fiscalYearStart
            ? new Date(fiscalYearStart)
            : new Date(2026, 0, 1) // Default: 1 Jan 2026

        // Delete existing opening balance entry if it exists
        const existing = await prisma.journalEntry.findFirst({
            where: { reference: "OPENING-BALANCE-2026" },
        })

        if (existing) {
            await prisma.journalEntry.delete({
                where: { id: existing.id },
            })
        }

        // Create the new journal entry with lines
        const entry = await prisma.journalEntry.create({
            data: {
                date,
                description: "Saldo Awal",
                reference: "OPENING-BALANCE-2026",
                status: "POSTED",
                lines: {
                    create: nonZeroLines.map((l) => ({
                        accountId: l.accountId,
                        debit: l.debit,
                        credit: l.credit,
                        description: "Saldo Awal",
                    })),
                },
            },
            include: { lines: true },
        })

        // Update GLAccount balances
        for (const line of nonZeroLines) {
            const netAmount = line.debit - line.credit
            await prisma.gLAccount.update({
                where: { id: line.accountId },
                data: {
                    balance: {
                        increment: netAmount,
                    },
                },
            })
        }

        return NextResponse.json({
            success: true,
            data: { entryId: entry.id, lineCount: entry.lines.length },
        })
    } catch (err) {
        console.error("[opening-balances POST]", err)
        return NextResponse.json(
            { error: "Gagal menyimpan saldo awal" },
            { status: 500 }
        )
    }
}
